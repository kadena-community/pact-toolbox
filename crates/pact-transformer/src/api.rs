use napi::Result;
use napi_derive::napi;
use std::collections::HashMap;

/// Main Pact Transformer API
///
/// This is the primary interface for all Pact transformation operations.
/// It provides a unified API for parsing, transforming, and generating code.
#[napi]
pub struct PactTransformer {
  transformer: crate::CoreTransformer,
}

#[napi]
impl PactTransformer {
  /// Create a new PactTransformer instance
  #[napi(constructor)]
  pub fn new() -> Self {
    Self {
      transformer: crate::CoreTransformer::new(),
    }
  }

  /// Transform Pact source to JavaScript/TypeScript
  ///
  /// ```javascript
  /// const pact = new PactTransformer();
  /// const result = await pact.transform(source, { generateTypes: true });
  /// console.log(result.javascript, result.typescript);
  /// ```
  #[napi]
  pub async fn transform(
    &self,
    source: String,
    options: Option<crate::TransformOptions>,
  ) -> Result<TransformResult> {
    let result = crate::core_transform(source, options).await?;

    Ok(TransformResult {
      javascript: result.code,
      typescript: Some(result.types).filter(|t| !t.is_empty()),
      source_map: None, // TODO: implement source maps
    })
  }

  /// Get parsing errors for source code
  ///
  /// ```javascript
  /// const errors = pact.getErrors(invalidSource);
  /// errors.forEach(err => console.log(`${err.line}:${err.column} ${err.message}`));
  /// ```
  #[napi]
  pub fn get_errors(&mut self, source: String) -> Vec<ErrorInfo> {
    self
      .transformer
      .get_errors(source)
      .into_iter()
      .map(|e| ErrorInfo {
        message: e.message,
        line: e.line,
        column: e.column,
      })
      .collect()
  }

  /// Parse Pact source and return module AST
  ///
  /// ```javascript
  /// const modules = pact.parse(source);
  /// modules.forEach(m => console.log(`Module: ${m.name}`));
  /// ```
  #[napi]
  pub fn parse(&mut self, source: String) -> Result<Vec<ModuleInfo>> {
    let (modules, _errors) = self.transformer.parse(&source);
    Ok(
      modules
        .into_iter()
        .map(|m| ModuleInfo {
          name: m.name,
          namespace: m.namespace,
          governance: m.governance,
          doc: m.doc,
          function_count: m.functions.len() as u32,
          schema_count: m.schemas.len() as u32,
          capability_count: m.capabilities.len() as u32,
          constant_count: m.constants.len() as u32,
        })
        .collect(),
    )
  }
}

/// File operations API
#[napi]
pub struct FileOps;

#[napi]
impl FileOps {
  /// Transform a single file to disk
  #[napi]
  pub async fn transform_file(
    input_path: String,
    options: Option<crate::TransformOptions>,
    file_options: Option<crate::FileOutputOptions>,
  ) -> Result<FileResult> {
    let result = crate::file_transform(input_path, options, file_options).await?;

    Ok(FileResult {
      source_path: result.input_path,
      output_path: result.output_paths.get(0).cloned(),
      success: result.success,
      error: result.error,
      time_ms: result.processing_time_ms,
    })
  }

  /// Transform multiple files to disk
  #[napi]
  pub async fn transform_files(
    patterns: Vec<String>,
    options: Option<crate::TransformOptions>,
    file_options: Option<crate::FileOutputOptions>,
  ) -> Result<BatchResult> {
    let results = crate::batch_file_transform(patterns, options, file_options).await?;

    Ok(BatchResult {
      success_count: results.iter().filter(|r| r.success).count() as u32,
      error_count: results.iter().filter(|r| !r.success).count() as u32,
      total_time_ms: results.iter().map(|r| r.processing_time_ms).sum(),
      files: results
        .into_iter()
        .map(|r| FileResult {
          source_path: r.input_path,
          output_path: r.output_paths.get(0).cloned(),
          success: r.success,
          error: r.error,
          time_ms: r.processing_time_ms,
        })
        .collect(),
    })
  }

  /// Find Pact files matching patterns
  #[napi]
  pub async fn find_files(patterns: Vec<String>) -> Result<Vec<String>> {
    crate::find_pact_files(patterns, None, None).await
  }
}

/// Watch API for file monitoring
#[napi]
pub struct WatchSession {
  handle: crate::WatchHandle,
}

#[napi]
impl WatchSession {
  /// Start watching files
  #[napi(factory)]
  pub async fn start(
    patterns: Vec<String>,
    watch_options: Option<crate::WatchOptions>,
    transform_options: Option<crate::TransformOptions>,
    file_options: Option<crate::FileOutputOptions>,
  ) -> Result<WatchSession> {
    let mut watch_opts = watch_options.unwrap_or_default();
    watch_opts.patterns = patterns;

    let handle = crate::create_watch_session(Some(watch_opts), transform_options, file_options).await?;

    Ok(WatchSession { handle })
  }

  /// Stop watching
  #[napi]
  pub async fn stop(&self) -> Result<()> {
    self.handle.stop().await
  }

  /// Get watch statistics
  #[napi]
  pub async fn stats(&self) -> Result<WatchStatsResult> {
    let stats = self.handle.get_stats().await;
    Ok(WatchStatsResult {
      watched_files: stats.watched_files,
      total_transforms: stats.total_transforms,
      successful_transforms: stats.successful_transforms,
      failed_transforms: stats.failed_transforms,
      avg_transform_time_ms: stats.avg_transform_time_ms,
      uptime_ms: stats.uptime_ms,
    })
  }
}

/// Documentation generation API
#[napi]
pub struct DocsGenerator;

#[napi]
impl DocsGenerator {
  /// Generate documentation from Pact source
  #[napi]
  pub async fn generate(source: String, options: Option<crate::DocsOptions>) -> Result<DocsResult> {
    let opts = options.unwrap_or_default();

    // Parse modules first
    let mut transformer = crate::CoreTransformer::new();
    let (modules, _errors) = transformer.parse(&source);

    let format = opts.format.clone();
    let result = crate::generate_documentation(modules, opts).await?;
    Ok(DocsResult {
      content: result.content,
      format,
      assets: result
        .assets
        .into_iter()
        .map(|asset| (asset.path, asset.content))
        .collect(),
    })
  }
}

/// Test generation API
#[napi]
pub struct TestGenerator;

#[napi]
impl TestGenerator {
  /// Generate tests from Pact modules
  #[napi]
  pub async fn generate(
    source: String,
    options: Option<crate::TestGenOptions>,
  ) -> Result<TestResult> {
    let opts = options.unwrap_or_default();
    let typescript = opts.typescript.unwrap_or(false);
    let framework = opts.framework.clone();

    // Parse modules first
    let mut transformer = crate::CoreTransformer::new();
    let (modules, _errors) = transformer.parse(&source);

    let result = crate::generate_tests_for_modules(modules, opts).await?;

    let mut test_files = Vec::new();
    let extension = if typescript { "ts" } else { "js" };

    // Add main test file
    test_files.push(TestFile {
      path: format!("tests/{}.test.{}", framework, extension),
      content: result.tests,
    });

    // Add optional files
    if let Some(mocks) = result.mocks {
      test_files.push(TestFile {
        path: format!("tests/__mocks__/index.{}", extension),
        content: mocks,
      });
    }

    if let Some(fixtures) = result.fixtures {
      test_files.push(TestFile {
        path: format!("tests/__fixtures__/index.{}", extension),
        content: fixtures,
      });
    }

    Ok(TestResult {
      test_files,
      coverage_report: Some(result.setup_config),
    })
  }
}

/// Configuration management
#[napi]
pub struct ConfigManager;

#[napi]
impl ConfigManager {
  /// Load configuration from file
  #[napi]
  pub async fn load(
    path: Option<String>,
    environment: Option<String>,
  ) -> Result<crate::PactConfig> {
    let result = crate::load_config(path, environment).await?;
    Ok(result.config)
  }

  /// Validate configuration
  #[napi]
  pub fn validate(config: crate::PactConfig) -> Result<bool> {
    crate::validate_config(config)
  }
}

/// Plugin management
#[napi]
pub struct PluginManager;

#[napi]
impl PluginManager {
  /// Get list of available plugins
  #[napi]
  pub fn list() -> Vec<crate::PluginInfo> {
    crate::get_registered_plugins()
  }

  /// Register a built-in plugin
  #[napi]
  pub fn register(name: String) -> Result<bool> {
    crate::register_builtin_plugin(name)
  }

  /// Enable or disable a plugin
  #[napi]
  pub fn set_enabled(name: String, enabled: bool) -> Result<()> {
    crate::set_plugin_enabled(name, enabled)
  }
}

/// Utility functions
#[napi]
pub struct Utils;

#[napi]
impl Utils {
  /// Warm up the parser for better performance
  #[napi]
  pub fn warm_up() -> Result<()> {
    crate::warm_up_parsers()
  }

  /// Benchmark parser performance
  #[napi]
  pub fn benchmark(source: String, iterations: u32) -> Result<f64> {
    crate::run_parser_benchmark(source, iterations)
  }

  /// Reset optimization state
  #[napi]
  pub fn reset_optimizations() {
    crate::reset_parser_pool()
  }
}

// Result types

/// Transform operation result
#[napi(object)]
pub struct TransformResult {
  pub javascript: String,
  pub typescript: Option<String>,
  pub source_map: Option<String>,
}

/// File operation result
#[napi(object)]
pub struct FileResult {
  pub source_path: String,
  pub output_path: Option<String>,
  pub success: bool,
  pub error: Option<String>,
  pub time_ms: f64,
}

/// Batch operation result
#[napi(object)]
pub struct BatchResult {
  pub success_count: u32,
  pub error_count: u32,
  pub total_time_ms: f64,
  pub files: Vec<FileResult>,
}

/// Module information
#[napi(object)]
pub struct ModuleInfo {
  pub name: String,
  pub namespace: Option<String>,
  pub governance: String,
  pub doc: Option<String>,
  pub function_count: u32,
  pub schema_count: u32,
  pub capability_count: u32,
  pub constant_count: u32,
}

/// Error information
#[napi(object)]
pub struct ErrorInfo {
  pub message: String,
  pub line: u32,
  pub column: u32,
}

/// Watch statistics
#[napi(object)]
pub struct WatchStatsResult {
  pub watched_files: u32,
  pub total_transforms: u32,
  pub successful_transforms: u32,
  pub failed_transforms: u32,
  pub avg_transform_time_ms: f64,
  pub uptime_ms: f64,
}

/// Documentation result
#[napi(object)]
pub struct DocsResult {
  pub content: String,
  pub format: String,
  pub assets: HashMap<String, Vec<u8>>,
}

/// Test generation result
#[napi(object)]
pub struct TestResult {
  pub test_files: Vec<TestFile>,
  pub coverage_report: Option<String>,
}

/// Test file
#[napi(object)]
pub struct TestFile {
  pub path: String,
  pub content: String,
}

mod test;
