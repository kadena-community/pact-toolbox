use crate::ast::*;
use crate::parser::Parser;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::sync::{LazyLock, Mutex};

/// Global parser pool for reusing parsers
static PARSER_POOL: LazyLock<Mutex<Vec<Parser>>> = LazyLock::new(|| Mutex::new(Vec::new()));

/// Get a parser from the pool or create a new one
fn get_parser() -> Parser {
  let mut pool = PARSER_POOL.lock().unwrap();
  if let Some(parser) = pool.pop() {
    parser
  } else {
    Parser::new()
  }
}

/// Return a parser to the pool for reuse
fn return_parser(parser: Parser) {
  let mut pool = PARSER_POOL.lock().unwrap();
  if pool.len() < num_cpus::get() * 2 {
    pool.push(parser);
  }
  // Drop excess parsers to avoid memory bloat
}

/// Transform Pact source to JavaScript with performance optimizations
pub async fn core_transform(
  source: String,
  options: Option<TransformOptions>,
) -> Result<TransformationResult, napi::Error> {
  // Use tokio's spawn_blocking for CPU-intensive work
  tokio::task::spawn_blocking(move || {
    // Get parser from pool
    let mut parser = get_parser();

    // Parse modules
    let (modules, errors) = parser.parse(&source);

    if !errors.is_empty() {
      let error_messages: Vec<String> = errors
        .iter()
        .map(|e| format!("{}:{}: {}", e.line, e.column, e.message))
        .collect();
      return Err(napi::Error::from_reason(error_messages.join("\n")));
    }

    // Check if source maps are requested
    let generate_source_maps = options
      .as_ref()
      .and_then(|o| o.source_maps)
      .unwrap_or(false);

    let source_file_path = options
      .as_ref()
      .and_then(|o| o.source_file_path.as_deref())
      .unwrap_or("input.pact");

    let generate_types_flag = options
      .as_ref()
      .and_then(|o| o.generate_types)
      .unwrap_or(true);

    // Check if declaration maps are requested
    let generate_declaration_maps = options
      .as_ref()
      .and_then(|o| o.declaration_maps)
      .unwrap_or(false);

    // Generate code and types with or without source maps
    let (code, types, source_map, declaration_map) =
      if generate_source_maps || generate_declaration_maps {
        use crate::code_generator::CodeGenerator;
        use crate::source_map::SourceMapOptions;

        let source_map_options = SourceMapOptions {
          generate: Some(generate_source_maps),
          declaration_map: Some(generate_declaration_maps),
          ..SourceMapOptions::default()
        };

        let mut generator = CodeGenerator::new_with_source_maps(
          generate_types_flag,
          source_map_options,
          &source,
          source_file_path,
          &modules,
        );

        // Generate filenames based on source path
        let stem = std::path::Path::new(source_file_path)
          .file_stem()
          .and_then(|s| s.to_str())
          .unwrap_or("generated");
        let js_filename = Some(format!("{stem}.js"));
        let ts_filename = Some(format!("{stem}.pact.d.ts"));

        generator.generate_with_filenames(&modules, js_filename.as_deref(), ts_filename.as_deref())
      } else {
        // Use the simple parallel generation for better performance when no source maps needed
        let (code, types) = rayon::join(
          || generate_js(&modules),
          || {
            if generate_types_flag {
              generate_types(&modules)
            } else {
              String::new()
            }
          },
        );
        (code, types, None, None)
      };

    // Return parser to pool
    return_parser(parser);

    Ok(TransformationResult {
      modules,
      code,
      types,
      source_map,
      declaration_map,
    })
  })
  .await
  .map_err(|e| napi::Error::from_reason(e.to_string()))?
}

/// JavaScript code generation with string optimizations
fn generate_js(modules: &[PactModule]) -> String {
  use crate::code_generator::generate_js as gen_js;
  gen_js(modules)
}

/// TypeScript types generation
fn generate_types(modules: &[PactModule]) -> String {
  use crate::code_generator::generate_types as gen_types;
  gen_types(modules)
}

/// High-performance transformer with pooled parsers
pub struct CoreTransformer;

impl CoreTransformer {
  pub fn new() -> Self {
    Self
  }

  /// Transform Pact code with performance optimizations
  #[cfg(test)]
  #[allow(clippy::needless_pass_by_value)]
  #[allow(clippy::unused_self)]
  pub fn transform(&self, source: String) -> Result<Vec<PactModule>, napi::Error> {
    let mut parser = get_parser();

    let (modules, errors) = parser.parse(&source);

    if !errors.is_empty() {
      let error_messages: Vec<String> = errors
        .iter()
        .map(|e| format!("{}:{}: {}", e.line, e.column, e.message))
        .collect();
      return_parser(parser);
      return Err(napi::Error::from_reason(error_messages.join("\n")));
    }

    return_parser(parser);
    Ok(modules)
  }

  /// Parse method for testing - returns both modules and errors
  pub fn parse(source: &str) -> (Vec<PactModule>, Vec<crate::error::ParseError>) {
    let mut parser = get_parser();
    let result = parser.parse(source);
    return_parser(parser);
    result
  }

  pub fn get_errors(source: &str) -> Vec<crate::ErrorInfo> {
    let mut parser = get_parser();
    let (_, errors) = parser.parse(source);
    return_parser(parser);
    errors
      .into_iter()
      .map(|e| crate::ErrorInfo {
        message: e.message,
        line: e.line as u32,
        column: e.column as u32,
      })
      .collect()
  }
}

/// Transformation result
#[napi(object)]
pub struct TransformationResult {
  pub modules: Vec<PactModule>,
  pub code: String,
  pub types: String,
  pub source_map: Option<String>,
  pub declaration_map: Option<String>,
}

/// Transform options
#[napi(object)]
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TransformOptions {
  pub generate_types: Option<bool>,
  pub module_name: Option<String>,
  pub source_maps: Option<bool>,
  pub source_file_path: Option<String>,
  pub declaration_maps: Option<bool>,
}

/// Benchmark function to measure parser performance
#[allow(dead_code)]
pub fn run_parser_benchmark(source: &str, iterations: u32) -> Result<f64, napi::Error> {
  let start = std::time::Instant::now();

  for _ in 0..iterations {
    let mut parser = get_parser();
    let (modules, errors) = parser.parse(source);

    if !errors.is_empty() {
      return_parser(parser);
      return Err(napi::Error::from_reason("Parse error in benchmark"));
    }

    // Ensure modules are used to prevent optimization
    std::hint::black_box(modules);

    return_parser(parser);
  }

  let elapsed = start.elapsed();
  Ok(elapsed.as_secs_f64() / f64::from(iterations) * 1000.0) // Return average time in milliseconds
}

/// Warm up the parser pool for better initial performance
#[allow(dead_code)]
pub fn warm_up_parsers() {
  let pool_size = num_cpus::get();
  for _ in 0..pool_size {
    let parser = Parser::new();
    return_parser(parser);
  }
}

/// Reset the parser pool
#[allow(dead_code)]
pub fn reset_parser_pool() {
  let mut pool = PARSER_POOL.lock().unwrap();
  pool.clear();
}

impl Default for CoreTransformer {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_transformer_performance() {
    let source = r#"
        (module test-module GOVERNANCE
          (defcap GOVERNANCE () true)
          (defschema test-schema
            field1: string
            field2: integer)
          (defun test-function:string (param1:string)
            "test"))
        "#;

    let transformer = CoreTransformer::new();
    let result = transformer.transform(source.to_string()).unwrap();

    assert_eq!(result.len(), 1);
    assert_eq!(result[0].name, "test-module");
    assert_eq!(result[0].functions.len(), 1);
    assert_eq!(result[0].schemas.len(), 1);
  }

  #[tokio::test]
  async fn test_full_transformation() {
    let source = r#"
        (module test-module GOVERNANCE
          (defcap GOVERNANCE () true)
          (defschema test-schema
            field1: string
            field2: integer)
          (defun test-function:string (param1:string)
            "test"))
        "#;

    let result = core_transform(
      source.to_string(),
      Some(TransformOptions {
        generate_types: Some(true),
        module_name: None,
        source_maps: None,
        source_file_path: None,
        declaration_maps: None,
      }),
    )
    .await
    .unwrap();

    assert!(!result.code.is_empty());
    assert!(!result.types.is_empty());
    assert_eq!(result.modules.len(), 1);
  }
}
