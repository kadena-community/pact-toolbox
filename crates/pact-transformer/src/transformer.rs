use crate::ast::*;
use crate::frameworks::{CodeGenOptions, FrameworkGeneratorFactory};
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

    // Generate code and types in parallel using simple approach
    let (code, types) = rayon::join(
      || generate_js(&modules),
      || {
        if options
          .as_ref()
          .and_then(|o| o.generate_types)
          .unwrap_or(true)
        {
          generate_types(&modules)
        } else {
          String::new()
        }
      },
    );

    // Return parser to pool
    return_parser(parser);

    Ok(TransformationResult {
      modules,
      code,
      types,
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
  pub fn parse(&mut self, source: &str) -> (Vec<PactModule>, Vec<crate::error::ParseError>) {
    let mut parser = get_parser();
    let result = parser.parse(source);
    return_parser(parser);
    result
  }

  pub fn get_errors(&mut self, source: String) -> Vec<crate::ErrorDetail> {
    let mut parser = get_parser();
    let (_, errors) = parser.parse(&source);
    return_parser(parser);
    errors
      .into_iter()
      .map(|e| crate::ErrorDetail {
        message: e.message,
        line: e.line as u32,
        column: e.column as u32,
      })
      .collect()
  }
}

/// Transform Pact source to framework-specific code
pub async fn transform_to_framework(
  source: String,
  framework_options: CodeGenOptions,
) -> Result<FrameworkTransformResult, napi::Error> {
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
      return_parser(parser);
      return Err(napi::Error::from_reason(error_messages.join("\n")));
    }

    return_parser(parser);

    // Generate framework-specific code
    if framework_options.target == "vanilla" {
      // Use default code generator for vanilla JS
      let code = generate_js(&modules);
      let types = if framework_options.typescript.unwrap_or(true) {
        generate_types(&modules)
      } else {
        String::new()
      };

      Ok(FrameworkTransformResult {
        modules,
        code,
        types,
        additional_files: vec![],
      })
    } else {
      // Use framework-specific generator
      let generator = FrameworkGeneratorFactory::create(&framework_options.target)
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

      let result = generator
        .generate(&modules, &framework_options)
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

      Ok(FrameworkTransformResult {
        modules,
        code: result.code,
        types: result.types.unwrap_or_default(),
        additional_files: result
          .additional_files
          .into_iter()
          .map(|f| FrameworkFile {
            name: f.name,
            content: f.content,
            description: f.description,
          })
          .collect(),
      })
    }
  })
  .await
  .map_err(|e| napi::Error::from_reason(e.to_string()))?
}

/// Transformation result
#[napi(object)]
pub struct TransformationResult {
  pub modules: Vec<PactModule>,
  pub code: String,
  pub types: String,
}

/// Framework transformation result
#[napi(object)]
pub struct FrameworkTransformResult {
  pub modules: Vec<PactModule>,
  pub code: String,
  pub types: String,
  pub additional_files: Vec<FrameworkFile>,
}

/// Additional file generated by framework
#[napi(object)]
pub struct FrameworkFile {
  pub name: String,
  pub content: String,
  pub description: Option<String>,
}

/// Transform options
#[napi(object)]
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TransformOptions {
  pub generate_types: Option<bool>,
  pub module_name: Option<String>,
}

/// Benchmark function to measure parser performance
pub fn run_parser_benchmark(source: String, iterations: u32) -> Result<f64, napi::Error> {
  let start = std::time::Instant::now();

  for _ in 0..iterations {
    let mut parser = get_parser();
    let (modules, errors) = parser.parse(&source);

    if !errors.is_empty() {
      return_parser(parser);
      return Err(napi::Error::from_reason("Parse error in benchmark"));
    }

    // Ensure modules are used to prevent optimization
    std::hint::black_box(modules);

    return_parser(parser);
  }

  let elapsed = start.elapsed();
  Ok(elapsed.as_secs_f64() / iterations as f64 * 1000.0) // Return average time in milliseconds
}

/// Warm up the parser pool for better initial performance
pub fn warm_up_parsers() -> Result<(), napi::Error> {
  let pool_size = num_cpus::get();
  for _ in 0..pool_size {
    let parser = Parser::new();
    return_parser(parser);
  }
  Ok(())
}

/// Reset the parser pool
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
      }),
    )
    .await
    .unwrap();

    assert!(!result.code.is_empty());
    assert!(!result.types.is_empty());
    assert_eq!(result.modules.len(), 1);
  }
}
