use crate::code_generator::CodeGenerator;
use crate::parser::Parser;
use crate::source_map::{SourceMapGenerator, SourceMapOptions};
use crate::transformer::TransformOptions;
use anyhow::{Context, Result};
use napi_derive::napi;
use path_clean::PathClean;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOutputOptions {
  /// Output directory for generated files
  pub output_dir: String,

  /// Output format: js-types (separate .js and .d.ts), ts (single .ts file), or js-only
  pub format: String,

  /// Whether to create output directory if it doesn't exist
  pub create_dir: Option<bool>,

  /// Whether to preserve source directory structure
  pub preserve_structure: Option<bool>,

  /// Base path to strip from source files when preserving structure
  pub base_path: Option<String>,

  /// File extension to use for output files (default based on format)
  pub extension: Option<String>,

  /// Source map generation options
  pub source_maps: Option<SourceMapOptions>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransformResult {
  /// Input file path that was processed
  pub input_path: String,

  /// Output file paths that were created
  pub output_paths: Vec<String>,

  /// Whether the transformation was successful
  pub success: bool,

  /// Error message if transformation failed
  pub error: Option<String>,

  /// Processing time in milliseconds
  pub processing_time_ms: f64,
}

impl Default for FileOutputOptions {
  fn default() -> Self {
    Self {
      output_dir: "./generated".to_string(),
      format: "js-types".to_string(),
      create_dir: Some(true),
      preserve_structure: Some(false),
      base_path: None,
      extension: None,
      source_maps: Some(SourceMapOptions::default()),
    }
  }
}

/// Transform a single Pact file and write output to disk
pub async fn file_transform(
  input_path: String,
  options: Option<TransformOptions>,
  file_options: Option<FileOutputOptions>,
) -> Result<FileTransformResult, napi::Error> {
  let start_time = std::time::Instant::now();
  let file_opts = file_options.unwrap_or_default();
  let transform_opts = options.unwrap_or_default();

  match file_transform_impl(&input_path, &transform_opts, &file_opts) {
    Ok(output_paths) => Ok(FileTransformResult {
      input_path,
      output_paths,
      success: true,
      error: None,
      processing_time_ms: start_time.elapsed().as_secs_f64() * 1000.0,
    }),
    Err(e) => Ok(FileTransformResult {
      input_path,
      output_paths: vec![],
      success: false,
      error: Some(e.to_string()),
      processing_time_ms: start_time.elapsed().as_secs_f64() * 1000.0,
    }),
  }
}

fn file_transform_impl(
  input_path: &str,
  transform_opts: &TransformOptions,
  file_opts: &FileOutputOptions,
) -> Result<Vec<String>> {
  // Read the input file
  let source =
    fs::read_to_string(input_path).with_context(|| format!("Failed to read file: {input_path}"))?;

  // Parse the source
  let mut parser = Parser::new();
  let (modules, errors) = parser.parse(&source);

  if !errors.is_empty() {
    log::warn!("Parse errors in {input_path}: {errors:?}");
  }

  if modules.is_empty() {
    return Ok(vec![]); // No modules to process
  }

  // Determine if we should use source maps
  let use_source_maps = file_opts
    .source_maps
    .as_ref()
    .and_then(|sm| sm.generate)
    .unwrap_or(true);

  let (js_code, ts_types, source_map_json, _declaration_map_json) = if use_source_maps {
    // Use generator with source maps
    let mut generator = CodeGenerator::new_with_source_maps(
      transform_opts.generate_types.unwrap_or(true),
      file_opts.source_maps.clone().unwrap_or_default(),
      &source,
      input_path,
      &modules,
    );
    generator.generate(&modules)
  } else {
    // Use regular generator
    let mut generator = CodeGenerator::new(transform_opts.generate_types.unwrap_or(true));
    generator.generate(&modules)
  };

  // Determine output paths
  let input_path_buf = PathBuf::from(input_path);
  let base_name = input_path_buf
    .file_stem()
    .and_then(|s| s.to_str())
    .unwrap_or("output");

  let output_dir = determine_output_dir(&input_path_buf, file_opts);
  let mut output_paths = Vec::new();

  // Create output directory
  if file_opts.create_dir.unwrap_or(true) {
    fs::create_dir_all(&output_dir).with_context(|| {
      format!(
        "Failed to create output directory: {}",
        output_dir.display()
      )
    })?;
  }

  // Write files based on format
  match file_opts.format.as_str() {
    "js-types" => {
      // Write separate .js and .d.ts files
      if !js_code.is_empty() {
        let js_path = output_dir.join(format!("{base_name}.js"));
        let (final_js_code, map_paths) = add_source_map_to_code(
          &js_code,
          source_map_json.as_ref(),
          &js_path,
          &output_dir,
          base_name,
          false,
          file_opts,
        )?;

        fs::write(&js_path, final_js_code)
          .with_context(|| format!("Failed to write JS file: {}", js_path.display()))?;
        output_paths.push(js_path.to_string_lossy().to_string());
        output_paths.extend(map_paths);
      }

      if !ts_types.is_empty() {
        let dts_path = output_dir.join(format!("{base_name}.d.ts"));
        fs::write(&dts_path, ts_types)
          .with_context(|| format!("Failed to write .d.ts file: {}", dts_path.display()))?;
        output_paths.push(dts_path.to_string_lossy().to_string());
      }
    }
    "ts" => {
      // Write single .ts file with both code and types
      if !js_code.is_empty() || !ts_types.is_empty() {
        let mut combined = String::new();
        if !ts_types.is_empty() {
          combined.push_str(&ts_types);
          combined.push_str("\n\n");
        }
        if !js_code.is_empty() {
          // Convert JS code to TS by adding type annotations
          let ts_code = convert_js_to_ts(&js_code);
          combined.push_str(&ts_code);
        }

        let ts_path = output_dir.join(format!("{base_name}.ts"));
        let (final_ts_code, map_paths) = add_source_map_to_code(
          &combined,
          source_map_json.as_ref(),
          &ts_path,
          &output_dir,
          base_name,
          true,
          file_opts,
        )?;

        fs::write(&ts_path, final_ts_code)
          .with_context(|| format!("Failed to write TS file: {}", ts_path.display()))?;
        output_paths.push(ts_path.to_string_lossy().to_string());
        output_paths.extend(map_paths);
      }
    }
    "js-only" => {
      // Write only .js file
      if !js_code.is_empty() {
        let js_path = output_dir.join(format!("{base_name}.js"));
        let (final_js_code, map_paths) = add_source_map_to_code(
          &js_code,
          source_map_json.as_ref(),
          &js_path,
          &output_dir,
          base_name,
          false,
          file_opts,
        )?;

        fs::write(&js_path, final_js_code)
          .with_context(|| format!("Failed to write JS file: {}", js_path.display()))?;
        output_paths.push(js_path.to_string_lossy().to_string());
        output_paths.extend(map_paths);
      }
    }
    _ => {
      return Err(anyhow::anyhow!(
        "Unsupported output format: {}",
        file_opts.format
      ));
    }
  }

  Ok(output_paths)
}

fn determine_output_dir(input_path: &Path, file_opts: &FileOutputOptions) -> PathBuf {
  let output_base = PathBuf::from(&file_opts.output_dir);

  if !file_opts.preserve_structure.unwrap_or(false) {
    return output_base;
  }

  // Preserve directory structure
  let input_dir = input_path.parent().unwrap_or(Path::new("."));

  let relative_dir = if let Some(base_path) = &file_opts.base_path {
    let base = PathBuf::from(base_path);
    input_dir.strip_prefix(&base).unwrap_or(input_dir)
  } else {
    input_dir
  };

  output_base.join(relative_dir).clean()
}

fn convert_js_to_ts(js_code: &str) -> String {
  // Simple conversion from JS to TS by adding explicit return types
  // This is a basic implementation - for full TS support, more sophisticated parsing would be needed
  js_code.replace(") {", "): PactTransactionBuilder<PactExecPayload, any> {")
}

fn add_source_map_to_code(
  code: &str,
  source_map_json: Option<&String>,
  output_path: &Path,
  output_dir: &Path,
  base_name: &str,
  is_typescript: bool,
  file_opts: &FileOutputOptions,
) -> Result<(String, Vec<String>)> {
  let mut final_code = code.to_string();
  let mut additional_paths = Vec::new();

  if let Some(source_map_content) = source_map_json {
    let default_opts = SourceMapOptions::default();
    let source_map_opts = file_opts.source_maps.as_ref().unwrap_or(&default_opts);

    if source_map_opts.inline.unwrap_or(false) {
      // Inline source map
      use crate::source_map::SourceMapGenerator;
      let temp_generator = SourceMapGenerator::new(source_map_opts.clone());

      let inline_comment = temp_generator
        .generate_inline_comment(
          &output_path.file_name().unwrap().to_string_lossy(),
          is_typescript,
        )
        .map_err(|e| anyhow::anyhow!("Failed to generate inline source map: {}", e))?;

      final_code.push('\n');
      final_code.push_str(&inline_comment);
    } else {
      // External source map file
      let map_extension = source_map_opts.file_extension.as_deref().unwrap_or(".map");

      let map_file_name = if is_typescript {
        format!("{base_name}.ts{map_extension}")
      } else {
        format!("{base_name}.js{map_extension}")
      };

      let map_path = output_dir.join(&map_file_name);

      // Write source map file
      fs::write(&map_path, source_map_content)
        .with_context(|| format!("Failed to write source map file: {}", map_path.display()))?;

      additional_paths.push(map_path.to_string_lossy().to_string());

      // Add reference comment to code
      let _temp_generator = SourceMapGenerator::new(source_map_opts.clone());
      let reference_comment =
        SourceMapGenerator::generate_external_comment(&map_file_name, is_typescript);

      final_code.push('\n');
      final_code.push_str(&reference_comment);
    }
  }

  Ok((final_code, additional_paths))
}

/// Transform multiple Pact files in parallel and write output to disk
pub async fn batch_file_transform(
  input_paths: Vec<String>,
  options: Option<TransformOptions>,
  file_options: Option<FileOutputOptions>,
) -> Result<Vec<FileTransformResult>, napi::Error> {
  let file_opts = file_options.unwrap_or_default();
  let transform_opts = options.unwrap_or_default();

  // Process files in parallel using tokio
  let tasks: Vec<_> = input_paths
    .into_iter()
    .map(|path| {
      let file_opts = file_opts.clone();
      let transform_opts = transform_opts.clone();
      tokio::spawn(async move { file_transform(path, Some(transform_opts), Some(file_opts)).await })
    })
    .collect();

  let mut results = Vec::new();
  for task in tasks {
    match task.await {
      Ok(Ok(result)) => results.push(result),
      Ok(Err(e)) => return Err(e),
      Err(e) => return Err(napi::Error::from_reason(format!("Task failed: {e}"))),
    }
  }

  Ok(results)
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;
  use tempfile::TempDir;

  #[tokio::test]
  async fn test_file_transform_js_types() {
    let temp_dir = TempDir::new().unwrap();
    let input_path = temp_dir.path().join("test.pact");
    let output_dir = temp_dir.path().join("output");

    // Create test input file
    let pact_content = r#"
(module test GOVERNANCE
  (defun hello:string ()
    "Hello world"))
"#;
    fs::write(&input_path, pact_content).unwrap();

    let file_opts = FileOutputOptions {
      output_dir: output_dir.to_string_lossy().to_string(),
      format: "js-types".to_string(),
      create_dir: Some(true),
      preserve_structure: Some(false),
      base_path: None,
      extension: None,
      source_maps: Some(SourceMapOptions {
        generate: Some(false),
        ..Default::default()
      }),
    };

    let result = file_transform(
      input_path.to_string_lossy().to_string(),
      None,
      Some(file_opts),
    )
    .await
    .unwrap();

    assert!(result.success);
    assert_eq!(result.output_paths.len(), 2); // .js and .d.ts

    // Verify files exist
    let js_path = output_dir.join("test.js");
    let dts_path = output_dir.join("test.d.ts");
    assert!(js_path.exists());
    assert!(dts_path.exists());

    // Verify content
    let js_content = fs::read_to_string(&js_path).unwrap();
    let dts_content = fs::read_to_string(&dts_path).unwrap();

    assert!(js_content.contains("export function hello()"));
    assert!(dts_content.contains("export function hello():"));
  }

  #[tokio::test]
  async fn test_transform_file_to_disk_preserve_structure() {
    let temp_dir = TempDir::new().unwrap();
    let input_dir = temp_dir.path().join("src").join("contracts");
    let input_path = input_dir.join("test.pact");
    let output_dir = temp_dir.path().join("generated");

    // Create test input file with directory structure
    fs::create_dir_all(&input_dir).unwrap();
    let pact_content = r#"
(module test GOVERNANCE
  (defun hello:string ()
    "Hello world"))
"#;
    fs::write(&input_path, pact_content).unwrap();

    let file_opts = FileOutputOptions {
      output_dir: output_dir.to_string_lossy().to_string(),
      format: "ts".to_string(),
      create_dir: Some(true),
      preserve_structure: Some(true),
      base_path: Some(temp_dir.path().to_string_lossy().to_string()),
      extension: None,
      source_maps: Some(SourceMapOptions {
        generate: Some(false),
        ..Default::default()
      }),
    };

    let result = file_transform(
      input_path.to_string_lossy().to_string(),
      None,
      Some(file_opts),
    )
    .await
    .unwrap();

    assert!(result.success);
    assert_eq!(result.output_paths.len(), 1);

    // Verify file exists in preserved structure
    let expected_path = output_dir.join("src").join("contracts").join("test.ts");
    assert!(expected_path.exists());
  }

  #[tokio::test]
  async fn test_transform_file_with_source_maps() {
    let temp_dir = TempDir::new().unwrap();
    let input_path = temp_dir.path().join("test.pact");
    let output_dir = temp_dir.path().join("output");

    // Create test input file
    let pact_content = r#"
(module test GOVERNANCE
  (defun hello:string ()
    "Hello world"))
"#;
    fs::write(&input_path, pact_content).unwrap();

    let file_opts = FileOutputOptions {
      output_dir: output_dir.to_string_lossy().to_string(),
      format: "js-types".to_string(),
      create_dir: Some(true),
      preserve_structure: Some(false),
      base_path: None,
      extension: None,
      source_maps: Some(SourceMapOptions {
        generate: Some(true),
        inline: Some(false), // External source maps
        sources_content: Some(true),
        ..Default::default()
      }),
    };

    let result = file_transform(
      input_path.to_string_lossy().to_string(),
      None,
      Some(file_opts),
    )
    .await
    .unwrap();

    assert!(result.success);
    assert_eq!(result.output_paths.len(), 3); // .js, .d.ts, and .js.map

    // Verify files exist
    let js_path = output_dir.join("test.js");
    let dts_path = output_dir.join("test.d.ts");
    let map_path = output_dir.join("test.js.map");
    assert!(js_path.exists());
    assert!(dts_path.exists());
    assert!(map_path.exists());

    // Verify source map content
    let js_content = fs::read_to_string(&js_path).unwrap();
    let map_content = fs::read_to_string(&map_path).unwrap();

    // JS file should contain source map reference
    assert!(js_content.contains("//# sourceMappingURL=test.js.map"));

    // Source map should contain proper mappings
    assert!(map_content.contains("\"sources\":[\""));
    assert!(map_content.contains("\"sourcesContent\":["));
    assert!(map_content.contains("test.pact"));
    assert!(map_content.contains("defun hello"));
  }

  #[tokio::test]
  async fn test_transform_file_with_inline_source_maps() {
    let temp_dir = TempDir::new().unwrap();
    let input_path = temp_dir.path().join("test.pact");
    let output_dir = temp_dir.path().join("output");

    // Create test input file
    let pact_content = r#"
(module test GOVERNANCE
  (defun hello:string ()
    "Hello world"))
"#;
    fs::write(&input_path, pact_content).unwrap();

    let file_opts = FileOutputOptions {
      output_dir: output_dir.to_string_lossy().to_string(),
      format: "js-only".to_string(),
      create_dir: Some(true),
      preserve_structure: Some(false),
      base_path: None,
      extension: None,
      source_maps: Some(SourceMapOptions {
        generate: Some(true),
        inline: Some(true), // Inline source maps
        sources_content: Some(true),
        ..Default::default()
      }),
    };

    let result = file_transform(
      input_path.to_string_lossy().to_string(),
      None,
      Some(file_opts),
    )
    .await
    .unwrap();

    assert!(result.success);
    assert_eq!(result.output_paths.len(), 1); // Only .js file (inline map)

    // Verify file exists
    let js_path = output_dir.join("test.js");
    assert!(js_path.exists());

    // Verify inline source map content
    let js_content = fs::read_to_string(&js_path).unwrap();

    // JS file should contain inline source map
    assert!(js_content.contains("//# sourceMappingURL=data:application/json;charset=utf-8;base64,"));
  }

  #[tokio::test]
  async fn test_transform_files_parallel() {
    let temp_dir = TempDir::new().unwrap();
    let output_dir = temp_dir.path().join("output");

    // Create multiple test files
    let mut input_paths = Vec::new();
    for i in 0..5 {
      let input_path = temp_dir.path().join(format!("test{i}.pact"));
      let pact_content = format!(
        r#"
(module test{i} GOVERNANCE
  (defun hello{i}:string ()
    "Hello world {i}"))
"#
      );
      fs::write(&input_path, pact_content).unwrap();
      input_paths.push(input_path.to_string_lossy().to_string());
    }

    let file_opts = FileOutputOptions {
      output_dir: output_dir.to_string_lossy().to_string(),
      format: "js-types".to_string(),
      create_dir: Some(true),
      preserve_structure: Some(false),
      base_path: None,
      extension: None,
      source_maps: Some(SourceMapOptions {
        generate: Some(false),
        ..Default::default()
      }),
    };

    let results = batch_file_transform(input_paths, None, Some(file_opts))
      .await
      .unwrap();

    assert_eq!(results.len(), 5);
    for result in &results {
      assert!(result.success);
      assert_eq!(result.output_paths.len(), 2); // .js and .d.ts for each
    }

    // Verify all files exist
    for i in 0..5 {
      let js_path = output_dir.join(format!("test{i}.js"));
      let dts_path = output_dir.join(format!("test{i}.d.ts"));
      assert!(js_path.exists());
      assert!(dts_path.exists());
    }
  }
}
