use crate::file_ops::{file_transform, FileOutputOptions, FileTransformResult};
use crate::transformer::TransformOptions;
use anyhow::{Context, Result};
use glob::glob;
use napi_derive::napi;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, RwLock};
use walkdir::WalkDir;

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchOptions {
  /// Glob patterns to watch - examples: all pact files, src folder pact files
  pub patterns: Vec<String>,

  /// Directories to watch recursively
  pub directories: Option<Vec<String>>,

  /// File extensions to watch (default: [pact])
  pub extensions: Option<Vec<String>>,

  /// Debounce delay in milliseconds (default: 100ms)
  pub debounce_ms: Option<u32>,

  /// Maximum number of concurrent transformations (default: CPU count)
  pub max_concurrent: Option<u32>,

  /// Whether to process existing files on startup
  pub initial_transform: Option<bool>,

  /// Whether to watch for file deletions and clean up output files
  pub handle_deletions: Option<bool>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchEvent {
  /// Type of event: added, modified, removed
  pub event_type: String,

  /// Path of the file that changed
  pub file_path: String,

  /// Transform result (if applicable)
  pub transform_result: Option<FileTransformResult>,

  /// Timestamp of the event
  pub timestamp: f64,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchStats {
  /// Number of files currently being watched
  pub watched_files: u32,

  /// Total number of transformation events processed
  pub total_transforms: u32,

  /// Number of successful transformations
  pub successful_transforms: u32,

  /// Number of failed transformations
  pub failed_transforms: u32,

  /// Average transformation time in milliseconds
  pub avg_transform_time_ms: f64,

  /// Time since watch started in milliseconds
  pub uptime_ms: f64,
}

struct WatchState {
  watched_files: HashSet<PathBuf>,
  total_transforms: u32,
  successful_transforms: u32,
  failed_transforms: u32,
  total_transform_time_ms: f64,
  start_time: Instant,
}

impl Default for WatchOptions {
  fn default() -> Self {
    Self {
      patterns: vec!["**/*.pact".to_string()],
      directories: None,
      extensions: Some(vec!["pact".to_string()]),
      debounce_ms: Some(100),
      max_concurrent: Some(num_cpus::get() as u32),
      initial_transform: Some(true),
      handle_deletions: Some(true),
    }
  }
}

/// Start watching Pact files for changes and automatically transform them
pub async fn create_watch_session(
  watch_options: Option<WatchOptions>,
  transform_options: Option<TransformOptions>,
  file_options: Option<FileOutputOptions>,
) -> Result<WatchHandle, napi::Error> {
  let watch_opts = watch_options.unwrap_or_default();
  let transform_opts = transform_options.unwrap_or_default();
  let file_opts = file_options.unwrap_or_default();

  WatchHandle::new(watch_opts, transform_opts, file_opts)
    .await
    .map_err(|e| napi::Error::from_reason(e.to_string()))
}

#[napi]
pub struct WatchHandle {
  state: Arc<RwLock<WatchState>>,
  #[allow(dead_code)]
  event_sender: mpsc::UnboundedSender<WatchEvent>,
  _watcher: RecommendedWatcher,
  _task_handle: tokio::task::JoinHandle<()>,
}

#[napi]
impl WatchHandle {
  async fn new(
    watch_opts: WatchOptions,
    transform_opts: TransformOptions,
    file_opts: FileOutputOptions,
  ) -> Result<Self> {
    let state = Arc::new(RwLock::new(WatchState {
      watched_files: HashSet::new(),
      total_transforms: 0,
      successful_transforms: 0,
      failed_transforms: 0,
      total_transform_time_ms: 0.0,
      start_time: Instant::now(),
    }));

    let (event_tx, _event_rx) = mpsc::unbounded_channel();
    let (file_tx, file_rx) = mpsc::channel(1000);

    // Find initial files
    let initial_files = find_matching_files(&watch_opts);

    // Update watched files
    {
      let mut state_guard = state.write().await;
      state_guard.watched_files = initial_files.iter().cloned().collect();
    }

    // Process initial files if requested
    if watch_opts.initial_transform.unwrap_or(true) {
      for file_path in &initial_files {
        let _ = file_tx
          .send(FileEvent {
            path: file_path.clone(),
            event_type: FileEventType::Added,
          })
          .await;
      }
    }

    // Create file system watcher
    let file_tx_clone = file_tx.clone();
    let extensions = watch_opts
      .extensions
      .clone()
      .unwrap_or_else(|| vec!["pact".to_string()]);
    let debounce_duration = Duration::from_millis(u64::from(watch_opts.debounce_ms.unwrap_or(100)));

    let mut watcher =
      notify::recommended_watcher(move |res: Result<Event, notify::Error>| match res {
        Ok(event) => {
          if let Some(file_event) = process_notify_event(event, &extensions) {
            let _ = file_tx_clone.try_send(file_event);
          }
        }
        Err(e) => log::error!("Watch error: {e:?}"),
      })?;

    // Setup watches for directories and patterns
    setup_watchers(&mut watcher, &watch_opts)?;

    // Start file processing task
    let state_clone = state.clone();
    let event_tx_clone = event_tx.clone();
    let max_concurrent = watch_opts.max_concurrent.unwrap_or(num_cpus::get() as u32) as usize;

    let task_handle = tokio::spawn(async move {
      process_file_events(
        file_rx,
        state_clone,
        event_tx_clone,
        transform_opts,
        file_opts,
        max_concurrent,
        debounce_duration,
      )
      .await;
    });

    Ok(Self {
      state,
      event_sender: event_tx,
      _watcher: watcher,
      _task_handle: task_handle,
    })
  }

  /// Get the next watch event
  #[napi]
  pub fn next_event() -> Option<WatchEvent> {
    // This would need a receiver to be stored in the handle
    // For now, returning None as a placeholder
    None
  }

  /// Get current watch statistics
  #[napi]
  pub async fn get_stats(&self) -> WatchStats {
    let state = self.state.read().await;
    let avg_time = if state.total_transforms > 0 {
      state.total_transform_time_ms / f64::from(state.total_transforms)
    } else {
      0.0
    };

    WatchStats {
      watched_files: state.watched_files.len() as u32,
      total_transforms: state.total_transforms,
      successful_transforms: state.successful_transforms,
      failed_transforms: state.failed_transforms,
      avg_transform_time_ms: avg_time,
      uptime_ms: state.start_time.elapsed().as_secs_f64() * 1000.0,
    }
  }

  /// Stop watching and cleanup
  #[napi]
  pub fn stop() {
    // The watcher will be dropped automatically
    // Task will be cancelled when the handle is dropped
  }
}

#[derive(Debug, Clone)]
struct FileEvent {
  path: PathBuf,
  event_type: FileEventType,
}

#[derive(Debug, Clone)]
enum FileEventType {
  Added,
  Modified,
  Removed,
}

fn process_notify_event(event: Event, extensions: &[String]) -> Option<FileEvent> {
  let event_type = match event.kind {
    EventKind::Create(_) => FileEventType::Added,
    EventKind::Modify(_) => FileEventType::Modified,
    EventKind::Remove(_) => FileEventType::Removed,
    _ => return None,
  };

  for path in event.paths {
    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
      if extensions.contains(&ext.to_string()) {
        return Some(FileEvent {
          path,
          event_type: event_type.clone(),
        });
      }
    }
  }

  None
}

fn setup_watchers(watcher: &mut RecommendedWatcher, watch_opts: &WatchOptions) -> Result<()> {
  // Watch directories
  if let Some(directories) = &watch_opts.directories {
    for dir in directories {
      let path = Path::new(dir);
      if path.exists() {
        watcher
          .watch(path, RecursiveMode::Recursive)
          .with_context(|| format!("Failed to watch directory: {dir}"))?;
      }
    }
  }

  // Watch patterns (find parent directories to watch)
  for pattern in &watch_opts.patterns {
    if let Some(base_dir) = extract_base_dir_from_pattern(pattern) {
      let path = Path::new(&base_dir);
      if path.exists() {
        watcher
          .watch(path, RecursiveMode::Recursive)
          .with_context(|| format!("Failed to watch pattern base: {base_dir}"))?;
      }
    }
  }

  Ok(())
}

fn extract_base_dir_from_pattern(pattern: &str) -> Option<String> {
  // Extract the non-glob part of the pattern
  let first_part = pattern.split(['*', '?', '[', ']']).next()?;

  // Remove trailing slash if present
  let trimmed = first_part.trim_end_matches('/');

  if trimmed.is_empty() {
    return Some(".".to_string());
  }

  let path = Path::new(trimmed);

  // If it ends with a path separator, it's already a directory
  if first_part.ends_with('/') || first_part.ends_with('\\') {
    Some(trimmed.to_string())
  } else if let Some(parent) = path.parent() {
    let parent_str = parent.to_string_lossy().to_string();
    if parent_str.is_empty() {
      Some(".".to_string())
    } else {
      Some(parent_str)
    }
  } else {
    Some(".".to_string())
  }
}

fn find_matching_files(watch_opts: &WatchOptions) -> Vec<PathBuf> {
  let mut files = HashSet::new();

  // Find files matching patterns
  for pattern in &watch_opts.patterns {
    if let Ok(paths) = glob(pattern) {
      for path in paths.flatten() {
        if path.is_file() {
          files.insert(path);
        }
      }
    }
  }

  // Find files in directories
  if let Some(directories) = &watch_opts.directories {
    let default_extensions = vec!["pact".to_string()];
    let extensions = watch_opts
      .extensions
      .as_ref()
      .unwrap_or(&default_extensions);

    for dir in directories {
      let walker = WalkDir::new(dir)
        .into_iter()
        .filter_map(std::result::Result::ok);
      for entry in walker {
        if entry.file_type().is_file() {
          if let Some(ext) = entry.path().extension().and_then(|s| s.to_str()) {
            if extensions.contains(&ext.to_string()) {
              files.insert(entry.path().to_path_buf());
            }
          }
        }
      }
    }
  }

  files.into_iter().collect()
}

async fn process_file_events(
  mut file_rx: mpsc::Receiver<FileEvent>,
  state: Arc<RwLock<WatchState>>,
  event_tx: mpsc::UnboundedSender<WatchEvent>,
  transform_opts: TransformOptions,
  file_opts: FileOutputOptions,
  max_concurrent: usize,
  debounce_duration: Duration,
) {
  let (debounced_tx, debounced_rx) = mpsc::channel(1000);

  // Debouncing task
  let debounce_tx = debounced_tx.clone();
  tokio::spawn(async move {
    let mut pending_events: std::collections::HashMap<PathBuf, FileEvent> =
      std::collections::HashMap::new();
    let mut debounce_timer = tokio::time::interval(debounce_duration);

    loop {
      tokio::select! {
          Some(event) = file_rx.recv() => {
              pending_events.insert(event.path.clone(), event);
          }
          _ = debounce_timer.tick() => {
              if !pending_events.is_empty() {
                  let events: Vec<_> = pending_events.drain().map(|(_, v)| v).collect();
                  for event in events {
                      let _ = debounce_tx.send(event).await;
                  }
              }
          }
      }
    }
  });

  // Process debounced events with parallelization
  let semaphore = Arc::new(tokio::sync::Semaphore::new(max_concurrent));
  let mut debounced_rx = debounced_rx;

  while let Some(file_event) = debounced_rx.recv().await {
    let state_clone = state.clone();
    let event_tx_clone = event_tx.clone();
    let transform_opts_clone = transform_opts.clone();
    let file_opts_clone = file_opts.clone();
    let semaphore_clone = semaphore.clone();

    tokio::spawn(async move {
      let _permit = semaphore_clone.acquire().await.unwrap();

      match file_event.event_type {
        FileEventType::Added | FileEventType::Modified => {
          // Transform the file
          let path_str = file_event.path.to_string_lossy().to_string();
          let result = file_transform(
            path_str.clone(),
            Some(transform_opts_clone),
            Some(file_opts_clone),
          )
          .await;

          // Update statistics
          {
            let mut state_guard = state_clone.write().await;
            state_guard.total_transforms += 1;

            match &result {
              Ok(transform_result) => {
                if transform_result.success {
                  state_guard.successful_transforms += 1;
                } else {
                  state_guard.failed_transforms += 1;
                }
                state_guard.total_transform_time_ms += transform_result.processing_time_ms;
              }
              Err(_) => {
                state_guard.failed_transforms += 1;
              }
            }

            state_guard.watched_files.insert(file_event.path.clone());
          }

          // Send event
          let watch_event = WatchEvent {
            event_type: match file_event.event_type {
              FileEventType::Added => "added".to_string(),
              FileEventType::Modified => "modified".to_string(),
              FileEventType::Removed => "removed".to_string(),
            },
            file_path: path_str,
            transform_result: result.ok(),
            timestamp: std::time::SystemTime::now()
              .duration_since(std::time::UNIX_EPOCH)
              .unwrap_or_default()
              .as_secs_f64(),
          };

          let _ = event_tx_clone.send(watch_event);
        }
        FileEventType::Removed => {
          // Handle file deletion
          {
            let mut state_guard = state_clone.write().await;
            state_guard.watched_files.remove(&file_event.path);
          }

          let watch_event = WatchEvent {
            event_type: "removed".to_string(),
            file_path: file_event.path.to_string_lossy().to_string(),
            transform_result: None,
            timestamp: std::time::SystemTime::now()
              .duration_since(std::time::UNIX_EPOCH)
              .unwrap_or_default()
              .as_secs_f64(),
          };

          let _ = event_tx_clone.send(watch_event);
        }
      }
    });
  }
}

/// Find all Pact files matching the given patterns
pub fn find_pact_files(
  patterns: Vec<String>,
  directories: Option<Vec<String>>,
  extensions: Option<Vec<String>>,
) -> Vec<String> {
  let watch_opts = WatchOptions {
    patterns,
    directories,
    extensions,
    debounce_ms: None,
    max_concurrent: None,
    initial_transform: None,
    handle_deletions: None,
  };

  find_matching_files(&watch_opts)
    .into_iter()
    .map(|p| p.to_string_lossy().to_string())
    .collect()
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;
  use tempfile::TempDir;

  #[tokio::test]
  async fn test_find_pact_files() {
    let temp_dir = TempDir::new().unwrap();

    // Create test files
    let subdir = temp_dir.path().join("contracts");
    fs::create_dir_all(&subdir).unwrap();

    let files = vec![
      temp_dir.path().join("test1.pact"),
      temp_dir.path().join("test2.pact"),
      subdir.join("test3.pact"),
      subdir.join("test4.txt"), // Should be ignored
    ];

    for file in &files {
      fs::write(file, "test content").unwrap();
    }

    let patterns = vec![format!("{}/**/*.pact", temp_dir.path().display())];

    let found_files = find_pact_files(patterns, None, None);

    assert_eq!(found_files.len(), 3); // Only .pact files

    for found_file in &found_files {
      assert!(std::path::Path::new(found_file)
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pact")));
    }
  }

  #[tokio::test]
  async fn test_extract_base_dir_from_pattern() {
    assert_eq!(
      extract_base_dir_from_pattern("src/**/*.pact"),
      Some("src".to_string())
    );
    assert_eq!(
      extract_base_dir_from_pattern("contracts/test*.pact"),
      Some("contracts".to_string())
    );
    assert_eq!(
      extract_base_dir_from_pattern("**/*.pact"),
      Some(".".to_string())
    );
    assert_eq!(
      extract_base_dir_from_pattern("file.pact"),
      Some(".".to_string())
    );
  }
}
