#![warn(clippy::all)]
#![warn(clippy::pedantic)]
#![allow(clippy::missing_errors_doc)]
#![allow(clippy::missing_panics_doc)]
#![allow(clippy::cargo_common_metadata)]
#![allow(clippy::multiple_crate_versions)]
#![allow(clippy::wildcard_imports)]
#![allow(clippy::module_name_repetitions)]
#![allow(clippy::cast_possible_truncation)]
#![allow(clippy::too_many_lines)]

use napi::Result;
use napi_derive::napi;

mod ast;
mod code_generator;
mod config;
mod error;
mod file_ops;
mod parser;
mod plugin;
mod source_map;
mod transformer;
mod types;
mod utils;
mod watch;

// Internal re-exports
pub(crate) use config::*;
pub(crate) use file_ops::{batch_file_transform, file_transform, FileOutputOptions};
pub(crate) use transformer::{core_transform, CoreTransformer, TransformOptions};
pub(crate) use watch::{create_watch_session, WatchOptions};

// Re-export for testing
#[cfg(test)]
pub use crate::parser::Parser as PublicParser;

/// Simplified configuration interface for PactTransformer
#[napi(object)]
pub struct PactTransformerConfig {
  pub plugins: Option<Vec<PluginConfig>>,
  pub transform: Option<TransformOptions>,
  pub file_output: Option<FileOutputOptions>,
  pub watch: Option<WatchOptions>,
}

/// Main PactTransformer with configuration-driven API
#[napi]
pub struct PactTransformer {
  config: PactTransformerConfig,
}

#[napi]
impl PactTransformer {
  /// Transform code string with options
  #[napi]
  pub async fn transform(
    &self,
    code: String,
    options: Option<TransformOptions>,
  ) -> Result<TransformResult> {
    // Merge config options with call-specific options
    let mut merged_options = self.config.transform.clone().unwrap_or_default();
    if let Some(opts) = options {
      if opts.generate_types.is_some() {
        merged_options.generate_types = opts.generate_types;
      }
      if opts.module_name.is_some() {
        merged_options.module_name = opts.module_name;
      }
      if opts.source_maps.is_some() {
        merged_options.source_maps = opts.source_maps;
      }
      if opts.source_file_path.is_some() {
        merged_options.source_file_path = opts.source_file_path;
      }
      if opts.declaration_maps.is_some() {
        merged_options.declaration_maps = opts.declaration_maps;
      }
    }

    let result = core_transform(code, Some(merged_options)).await?;

    Ok(TransformResult {
      javascript: result.code,
      typescript: Some(result.types).filter(|t| !t.is_empty()),
      source_map: result.source_map,
      declaration_map: result.declaration_map,
    })
  }

  /// Transform single file with options and optional watch mode
  #[napi]
  pub async fn transform_file(
    &self,
    file_path: String,
    options: Option<TransformFileOptions>,
  ) -> Result<FileResult> {
    let opts = options.unwrap_or_default();

    // Merge config options with call-specific options
    let mut merged_transform_options = self.config.transform.clone().unwrap_or_default();
    if let Some(transform_opts) = opts.transform_options {
      if transform_opts.generate_types.is_some() {
        merged_transform_options.generate_types = transform_opts.generate_types;
      }
      if transform_opts.module_name.is_some() {
        merged_transform_options.module_name = transform_opts.module_name;
      }
      if transform_opts.source_maps.is_some() {
        merged_transform_options.source_maps = transform_opts.source_maps;
      }
      if transform_opts.source_file_path.is_some() {
        merged_transform_options.source_file_path = transform_opts.source_file_path;
      }
      if transform_opts.declaration_maps.is_some() {
        merged_transform_options.declaration_maps = transform_opts.declaration_maps;
      }
    }

    let file_options = self.config.file_output.clone();

    if opts.watch.unwrap_or(false) {
      // Start watch mode for single file
      let watch_options = self.config.watch.clone();
      let _session = create_watch_session(
        watch_options.map(|mut w| {
          w.patterns = vec![file_path.clone()];
          w
        }),
        Some(merged_transform_options.clone()),
        file_options.clone(),
      )
      .await?;

      // Give watch a moment to process
      tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    let result = file_transform(file_path, Some(merged_transform_options), file_options).await?;

    Ok(FileResult {
      source_path: result.input_path,
      output_path: result.output_paths.first().cloned(),
      success: result.success,
      error: result.error,
      time_ms: result.processing_time_ms,
    })
  }

  /// Transform multiple files with options and optional watch mode
  #[napi]
  pub async fn transform_files(
    &self,
    patterns: Vec<String>,
    options: Option<TransformFilesOptions>,
  ) -> Result<BatchResult> {
    let opts = options.unwrap_or_default();

    // Merge config options with call-specific options
    let mut merged_transform_options = self.config.transform.clone().unwrap_or_default();
    if let Some(transform_opts) = opts.transform_options {
      if transform_opts.generate_types.is_some() {
        merged_transform_options.generate_types = transform_opts.generate_types;
      }
      if transform_opts.module_name.is_some() {
        merged_transform_options.module_name = transform_opts.module_name;
      }
      if transform_opts.source_maps.is_some() {
        merged_transform_options.source_maps = transform_opts.source_maps;
      }
      if transform_opts.source_file_path.is_some() {
        merged_transform_options.source_file_path = transform_opts.source_file_path;
      }
      if transform_opts.declaration_maps.is_some() {
        merged_transform_options.declaration_maps = transform_opts.declaration_maps;
      }
    }

    let file_options = self.config.file_output.clone();

    if opts.watch.unwrap_or(false) {
      // Start watch mode for multiple files
      let watch_options = self.config.watch.clone();
      let _session = create_watch_session(
        watch_options.map(|mut w| {
          w.patterns.clone_from(&patterns);
          w
        }),
        Some(merged_transform_options.clone()),
        file_options.clone(),
      )
      .await?;

      // Give watch a moment to process
      tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    let results =
      batch_file_transform(patterns, Some(merged_transform_options), file_options).await?;

    Ok(BatchResult {
      success_count: results.iter().filter(|r| r.success).count() as u32,
      error_count: results.iter().filter(|r| !r.success).count() as u32,
      total_time_ms: results.iter().map(|r| r.processing_time_ms).sum(),
      files: results
        .into_iter()
        .map(|r| FileResult {
          source_path: r.input_path,
          output_path: r.output_paths.first().cloned(),
          success: r.success,
          error: r.error,
          time_ms: r.processing_time_ms,
        })
        .collect(),
    })
  }

  /// Get parsing errors for source code
  #[napi]
  #[allow(clippy::needless_pass_by_value)]
  #[must_use]
  pub fn get_errors(&self, source: String) -> Vec<ErrorInfo> {
    CoreTransformer::get_errors(&source)
      .into_iter()
      .map(|e| ErrorInfo {
        message: e.message,
        line: e.line,
        column: e.column,
      })
      .collect()
  }

  /// Parse Pact source and return module AST
  #[napi]
  #[allow(clippy::needless_pass_by_value)]
  pub fn parse(&self, source: String) -> Result<Vec<ModuleInfo>> {
    let (modules, _errors) = CoreTransformer::parse(&source);
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

/// Options for transformFile method
#[napi(object)]
pub struct TransformFileOptions {
  pub transform_options: Option<TransformOptions>,
  pub watch: Option<bool>,
}

impl Default for TransformFileOptions {
  fn default() -> Self {
    Self {
      transform_options: None,
      watch: Some(false),
    }
  }
}

/// Options for transformFiles method
#[napi(object)]
pub struct TransformFilesOptions {
  pub transform_options: Option<TransformOptions>,
  pub watch: Option<bool>,
}

impl Default for TransformFilesOptions {
  fn default() -> Self {
    Self {
      transform_options: None,
      watch: Some(false),
    }
  }
}

/// Factory function to create a PactTransformer
#[napi]
pub fn create_pact_transformer(config: Option<PactTransformerConfig>) -> Result<PactTransformer> {
  let config = config.unwrap_or(PactTransformerConfig {
    plugins: None,
    transform: None,
    file_output: None,
    watch: None,
  });

  Ok(PactTransformer { config })
}

// Result types

/// Transform operation result
#[napi(object)]
pub struct TransformResult {
  pub javascript: String,
  pub typescript: Option<String>,
  pub source_map: Option<String>,
  pub declaration_map: Option<String>,
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

#[cfg(test)]
mod integration_tests {
  use super::*;

  const SIMPLE_MODULE: &str = r#"
    (module simple-test GOVERNANCE
      @doc "A simple test module"

      (defcap GOVERNANCE () true)

      (defschema user-schema
        @doc "User account schema"
        name: string
        age: integer)

      (defun create-user:string (name:string age:integer)
        @doc "Create a new user"
        (insert users name { "name": name, "age": age })
        name)

      (defconst MAX_AGE:integer 120)
    )
    "#;

  #[test]
  fn test_pact_transformer_integration() {
    let (modules, errors) = CoreTransformer::parse(SIMPLE_MODULE);

    assert!(errors.is_empty(), "Should parse without errors: {errors:?}");
    assert_eq!(modules.len(), 1, "Should parse exactly one module");

    let module = &modules[0];
    assert_eq!(module.name, "simple-test");
    assert_eq!(module.governance, "GOVERNANCE");

    // Check functions
    assert_eq!(module.functions.len(), 1, "Should parse one function");
    let function = &module.functions[0];
    assert_eq!(function.name, "create-user");
    assert_eq!(
      function.parameters.len(),
      2,
      "Function should have 2 parameters"
    );

    // Check parameters
    assert_eq!(function.parameters[0].name, "name");
    assert_eq!(function.parameters[1].name, "age");

    // Check schemas
    assert_eq!(module.schemas.len(), 1, "Should parse one schema");
    let schema = &module.schemas[0];
    assert_eq!(schema.name, "user-schema");
    assert_eq!(schema.fields.len(), 2, "Schema should have 2 fields");

    // Check capabilities
    assert_eq!(module.capabilities.len(), 1, "Should parse one capability");
    let capability = &module.capabilities[0];
    assert_eq!(capability.name, "GOVERNANCE");

    // Check constants
    assert_eq!(module.constants.len(), 1, "Should parse one constant");
    let constant = &module.constants[0];
    assert_eq!(constant.name, "MAX_AGE");
  }

  #[test]
  fn test_empty_module_parsing() {
    let (modules, errors) = CoreTransformer::parse("(module empty GOVERNANCE)");

    assert!(
      errors.is_empty(),
      "Empty module should parse without errors"
    );
    assert_eq!(modules.len(), 1, "Should parse one empty module");

    let module = &modules[0];
    assert_eq!(module.name, "empty");
    assert_eq!(module.governance, "GOVERNANCE");
    assert_eq!(module.functions.len(), 0);
    assert_eq!(module.schemas.len(), 0);
    assert_eq!(module.capabilities.len(), 0);
    assert_eq!(module.constants.len(), 0);
  }

  #[test]
  fn test_multiple_modules() {
    let multi_module = r"
        (module first GOVERNANCE
          (defcap GOVERNANCE () true))
        
        (module second OTHER-GOV
          (defcap OTHER-GOV () true))
        ";

    let (modules, errors) = CoreTransformer::parse(multi_module);
    assert!(
      errors.is_empty(),
      "Multi-module should parse without errors"
    );
    assert_eq!(modules.len(), 2, "Should parse two modules");

    assert_eq!(modules[0].name, "first");
    assert_eq!(modules[0].governance, "GOVERNANCE");
    assert_eq!(modules[1].name, "second");
    assert_eq!(modules[1].governance, "OTHER-GOV");
  }
}
