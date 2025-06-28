mod angular;
mod react;
mod svelte;
mod vue;

use crate::ast::PactModule;
use anyhow::Result;
use napi_derive::napi;
use serde::{Deserialize, Serialize};

pub use angular::AngularGenerator;
pub use react::ReactGenerator;
pub use svelte::SvelteGenerator;
pub use vue::VueGenerator;

/// Framework-specific code generation options
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeGenOptions {
  /// Target framework: "vanilla", "react", "vue", "angular", "svelte"
  pub target: String,

  /// Generation patterns: "hooks", "composables", "services", "stores"
  pub patterns: Vec<String>,

  /// Framework version for compatibility
  pub framework_version: Option<String>,

  /// Enable tree-shaking optimizations
  pub tree_shaking: Option<bool>,

  /// Enable bundle splitting
  pub bundle_splitting: Option<bool>,

  /// TypeScript generation
  pub typescript: Option<bool>,

  /// Use modern syntax features
  pub modern_syntax: Option<bool>,
}

impl Default for CodeGenOptions {
  fn default() -> Self {
    Self {
      target: "vanilla".to_string(),
      patterns: vec![],
      framework_version: None,
      tree_shaking: Some(true),
      bundle_splitting: Some(false),
      typescript: Some(true),
      modern_syntax: Some(true),
    }
  }
}

/// Base trait for framework-specific code generators
pub trait FrameworkGenerator: Send + Sync {
  /// Get the framework name
  fn name(&self) -> &'static str;

  /// Get the supported patterns for this framework
  fn supported_patterns(&self) -> Vec<&'static str>;

  /// Generate framework-specific code from modules
  fn generate(&self, modules: &[PactModule], options: &CodeGenOptions) -> Result<GeneratedCode>;

  /// Get the file extension for generated files
  fn file_extension(&self, typescript: bool) -> &'static str;
}

/// Generated code output
#[derive(Debug, Clone)]
pub struct GeneratedCode {
  /// Main code file content
  pub code: String,

  /// TypeScript declarations (if applicable)
  pub types: Option<String>,

  /// Additional files (e.g., stores, services)
  pub additional_files: Vec<AdditionalFile>,

  /// Import statements to prepend
  pub imports: Vec<String>,

  /// Export statements to append
  pub exports: Vec<String>,
}

/// Additional generated file
#[derive(Debug, Clone)]
pub struct AdditionalFile {
  /// File name (without path)
  pub name: String,

  /// File content
  pub content: String,

  /// File description
  pub description: Option<String>,
}

/// Factory for creating framework generators
pub struct FrameworkGeneratorFactory;

impl FrameworkGeneratorFactory {
  /// Create a generator for the specified target
  pub fn create(target: &str) -> Result<Box<dyn FrameworkGenerator>> {
    match target.to_lowercase().as_str() {
      "vanilla" => Err(anyhow::anyhow!(
        "Vanilla JS uses the default code generator"
      )),
      "react" => Ok(Box::new(ReactGenerator::new())),
      "vue" => Ok(Box::new(VueGenerator::new())),
      "angular" => Ok(Box::new(AngularGenerator::new())),
      "svelte" => Ok(Box::new(SvelteGenerator::new())),
      _ => Err(anyhow::anyhow!("Unknown framework target: {}", target)),
    }
  }

  /// Get all supported targets
  pub fn supported_targets() -> Vec<&'static str> {
    vec!["vanilla", "react", "vue", "angular", "svelte"]
  }
}

/// Common utilities for framework generators
pub mod utils {
  use crate::ast::{PactFunction, PactModule};

  /// Convert function name to hook name (for React)
  pub fn to_hook_name(function_name: &str) -> String {
    format!("use{}", to_pascal_case(function_name))
  }

  /// Convert function name to composable name (for Vue)
  pub fn to_composable_name(function_name: &str) -> String {
    format!("use{}", to_pascal_case(function_name))
  }

  /// Convert module name to service name (for Angular)
  pub fn to_service_name(module_name: &str) -> String {
    format!("{}Service", to_pascal_case(module_name))
  }

  /// Convert module name to store name (for Svelte)
  pub fn to_store_name(module_name: &str) -> String {
    format!("{}Store", to_camel_case(module_name))
  }

  /// Check if function is a query (read operation)
  pub fn is_query_function(function: &PactFunction) -> bool {
    function.is_defun
      && (function.name.starts_with("get")
        || function.name.starts_with("list")
        || function.name.starts_with("fetch")
        || function.name.starts_with("read")
        || function.name.starts_with("view"))
  }

  /// Check if function is a mutation (write operation)
  pub fn is_mutation_function(function: &PactFunction) -> bool {
    !function.is_defun
      || (function.name.starts_with("create")
        || function.name.starts_with("update")
        || function.name.starts_with("delete")
        || function.name.starts_with("remove")
        || function.name.starts_with("add")
        || function.name.starts_with("set"))
  }

  /// Group functions by operation type
  pub fn group_functions_by_type(module: &PactModule) -> (Vec<&PactFunction>, Vec<&PactFunction>) {
    let mut queries = Vec::new();
    let mut mutations = Vec::new();

    for function in &module.functions {
      if is_query_function(function) {
        queries.push(function);
      } else {
        mutations.push(function);
      }
    }

    (queries, mutations)
  }

  // Case conversion utilities
  pub fn to_pascal_case(s: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = true;

    for c in s.chars() {
      if c == '-' || c == '_' {
        capitalize_next = true;
      } else if capitalize_next {
        result.push(c.to_uppercase().next().unwrap_or(c));
        capitalize_next = false;
      } else {
        result.push(c);
      }
    }

    result
  }

  pub fn to_camel_case(s: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = false;

    for (i, c) in s.chars().enumerate() {
      if c == '-' || c == '_' {
        capitalize_next = true;
      } else if i == 0 {
        result.push(c.to_lowercase().next().unwrap_or(c));
      } else if capitalize_next {
        result.push(c.to_uppercase().next().unwrap_or(c));
        capitalize_next = false;
      } else {
        result.push(c);
      }
    }

    result
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_framework_factory() {
    assert!(FrameworkGeneratorFactory::create("react").is_ok());
    assert!(FrameworkGeneratorFactory::create("vue").is_ok());
    assert!(FrameworkGeneratorFactory::create("angular").is_ok());
    assert!(FrameworkGeneratorFactory::create("svelte").is_ok());
    assert!(FrameworkGeneratorFactory::create("vanilla").is_err());
    assert!(FrameworkGeneratorFactory::create("unknown").is_err());
  }

  #[test]
  fn test_case_conversions() {
    assert_eq!(utils::to_hook_name("get-user"), "useGetUser");
    assert_eq!(utils::to_composable_name("fetch-data"), "useFetchData");
    assert_eq!(utils::to_service_name("user-module"), "UserModuleService");
    assert_eq!(utils::to_store_name("app-state"), "appStateStore");
  }

  #[test]
  fn test_function_type_detection() {
    use crate::ast::PactFunction;

    let query = PactFunction {
      name: "get-users".to_string(),
      doc: None,
      parameters: vec![],
      return_type: Some("array".to_string()),
      body: String::new(),
      is_defun: true,
    };

    let mutation = PactFunction {
      name: "create-user".to_string(),
      doc: None,
      parameters: vec![],
      return_type: Some("string".to_string()),
      body: String::new(),
      is_defun: true,
    };

    assert!(utils::is_query_function(&query));
    assert!(utils::is_mutation_function(&mutation));
  }
}
