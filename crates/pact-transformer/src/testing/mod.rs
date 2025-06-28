mod ava;
mod coverage;
mod jest;
mod mocha;
mod mocks;
mod vitest;

use crate::ast::PactModule;
use anyhow::Result;
use napi_derive::napi;
use serde::{Deserialize, Serialize};

pub use ava::AvaGenerator;
pub use jest::JestGenerator;
pub use mocha::MochaGenerator;
pub use mocks::MockValue;
pub use vitest::VitestGenerator;

/// Test generation options
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestGenOptions {
  /// Test framework: "jest", "vitest", "mocha", "ava"
  pub framework: String,

  /// Generate mock data
  pub generate_mocks: Option<bool>,

  /// Generate test fixtures
  pub generate_fixtures: Option<bool>,

  /// Coverage targets (function names or patterns)
  pub coverage_targets: Option<Vec<String>>,

  /// Generate integration tests
  pub integration_tests: Option<bool>,

  /// Use TypeScript
  pub typescript: Option<bool>,

  /// Test timeout in milliseconds
  pub timeout: Option<u32>,

  /// Generate property-based tests
  pub property_tests: Option<bool>,

  /// Number of property test cases
  pub property_test_runs: Option<u32>,

  /// Generate snapshot tests
  pub snapshot_tests: Option<bool>,

  /// Mock provider (faker, chance, casual)
  pub mock_provider: Option<String>,
}

impl Default for TestGenOptions {
  fn default() -> Self {
    Self {
      framework: "vitest".to_string(),
      generate_mocks: Some(true),
      generate_fixtures: Some(true),
      coverage_targets: None,
      integration_tests: Some(false),
      typescript: Some(true),
      timeout: Some(5000),
      property_tests: Some(false),
      property_test_runs: Some(100),
      snapshot_tests: Some(false),
      mock_provider: Some("faker".to_string()),
    }
  }
}

/// Base trait for test framework generators
pub trait TestGenerator: Send + Sync {
  /// Get the framework name
  fn name(&self) -> &'static str;

  /// Get the test file extension
  fn file_extension(&self, typescript: bool) -> &'static str;

  /// Generate test suite for modules
  fn generate_tests(&self, modules: &[PactModule], options: &TestGenOptions) -> Result<TestSuite>;

  /// Generate test setup/configuration
  fn generate_setup(&self, options: &TestGenOptions) -> Result<TestSetup>;

  /// Get required dependencies
  fn get_dependencies(&self, options: &TestGenOptions) -> Vec<TestDependency>;
}

/// Generated test suite
#[derive(Debug, Clone)]
pub struct TestSuite {
  /// Main test file content
  pub tests: String,

  /// Mock implementations
  pub mocks: Option<String>,

  /// Test fixtures
  pub fixtures: Option<String>,

  /// Test utilities/helpers
  pub helpers: Option<String>,

  /// Integration test files
  pub integration_tests: Vec<IntegrationTest>,

  /// Property test specifications
  pub property_tests: Option<String>,
}

/// Test setup/configuration
#[derive(Debug, Clone)]
pub struct TestSetup {
  /// Configuration file content
  pub config: String,

  /// Configuration file name
  pub config_file: String,

  /// Setup script content (if needed)
  pub setup_script: Option<String>,

  /// Environment file content
  pub env_file: Option<String>,
}

/// Integration test file
#[derive(Debug, Clone)]
pub struct IntegrationTest {
  /// Test name
  pub name: String,

  /// Test file content
  pub content: String,

  /// Test description
  pub description: Option<String>,
}

/// Test dependency information
#[derive(Debug, Clone)]
pub struct TestDependency {
  /// Package name
  pub name: String,

  /// Version requirement
  pub version: String,

  /// Dev dependency?
  pub dev: bool,

  /// Optional dependency?
  pub optional: bool,
}

/// Factory for creating test generators
pub struct TestGeneratorFactory;

impl TestGeneratorFactory {
  /// Create a generator for the specified framework
  pub fn create(framework: &str) -> Result<Box<dyn TestGenerator>> {
    match framework.to_lowercase().as_str() {
      "jest" => Ok(Box::new(JestGenerator::new())),
      "vitest" => Ok(Box::new(VitestGenerator::new())),
      "mocha" => Ok(Box::new(MochaGenerator::new())),
      "ava" => Ok(Box::new(AvaGenerator::new())),
      _ => Err(anyhow::anyhow!("Unknown test framework: {}", framework)),
    }
  }

  /// Get all supported frameworks
  pub fn supported_frameworks() -> Vec<&'static str> {
    vec!["jest", "vitest", "mocha", "ava"]
  }
}

/// Common test generation utilities
pub mod utils {
  use super::MockValue;
  use crate::ast::{PactFunction, PactSchema, SchemaField};

  /// Generate test case name
  pub fn generate_test_name(function: &PactFunction, test_type: &str) -> String {
    format!("{} - {}", function.name, test_type)
  }

  /// Generate describe block name
  pub fn generate_describe_name(module_name: &str) -> String {
    format!("{} module", module_name)
  }

  /// Check if function should have integration tests
  pub fn should_have_integration_test(function: &PactFunction) -> bool {
    // Functions that interact with tables or have side effects
    function.body.contains("insert")
      || function.body.contains("update")
      || function.body.contains("write")
      || function.body.contains("with-read")
      || !function.is_defun // defpacts always need integration tests
  }

  /// Generate assertion for return type
  pub fn generate_type_assertion(return_type: &Option<String>, framework: &str) -> String {
    match return_type.as_deref() {
      Some("string") => match framework {
        "jest" | "vitest" => "expect(typeof result).toBe('string')".to_string(),
        "mocha" => "expect(result).to.be.a('string')".to_string(),
        "ava" => "t.is(typeof result, 'string')".to_string(),
        _ => "// Type assertion".to_string(),
      },
      Some("integer") | Some("decimal") => match framework {
        "jest" | "vitest" => "expect(typeof result).toBe('number')".to_string(),
        "mocha" => "expect(result).to.be.a('number')".to_string(),
        "ava" => "t.is(typeof result, 'number')".to_string(),
        _ => "// Type assertion".to_string(),
      },
      Some("bool") => match framework {
        "jest" | "vitest" => "expect(typeof result).toBe('boolean')".to_string(),
        "mocha" => "expect(result).to.be.a('boolean')".to_string(),
        "ava" => "t.is(typeof result, 'boolean')".to_string(),
        _ => "// Type assertion".to_string(),
      },
      Some(t) if t.starts_with("object{") => match framework {
        "jest" | "vitest" => "expect(result).toBeInstanceOf(Object)".to_string(),
        "mocha" => "expect(result).to.be.an('object')".to_string(),
        "ava" => "t.is(typeof result, 'object')".to_string(),
        _ => "// Type assertion".to_string(),
      },
      Some(t) if t.starts_with("[") => match framework {
        "jest" | "vitest" => "expect(Array.isArray(result)).toBe(true)".to_string(),
        "mocha" => "expect(result).to.be.an('array')".to_string(),
        "ava" => "t.true(Array.isArray(result))".to_string(),
        _ => "// Type assertion".to_string(),
      },
      _ => "// Unknown type assertion".to_string(),
    }
  }

  /// Generate mock value for a schema field
  pub fn generate_mock_for_field(field: &SchemaField) -> MockValue {
    MockValue::from_pact_type(&field.field_type, Some(&field.name))
  }

  /// Generate mock object for a schema
  pub fn generate_mock_for_schema(schema: &PactSchema) -> MockValue {
    let mut fields = std::collections::HashMap::new();

    for field in &schema.fields {
      fields.insert(field.name.clone(), generate_mock_for_field(field));
    }

    MockValue::Object(fields)
  }

  /// Check if function has side effects
  pub fn has_side_effects(function: &PactFunction) -> bool {
    function.body.contains("insert")
      || function.body.contains("update")
      || function.body.contains("write")
      || function.body.contains("emit-event")
      || function.body.contains("enforce")
  }

  /// Get test categories for a function
  pub fn get_test_categories(function: &PactFunction) -> Vec<&'static str> {
    let mut categories = vec!["happy-path"];

    if function.parameters.len() > 0 {
      categories.push("input-validation");
    }

    if has_side_effects(function) {
      categories.push("side-effects");
    }

    if function.body.contains("enforce") {
      categories.push("authorization");
      categories.push("error-cases");
    }

    if function.return_type.is_some() {
      categories.push("return-type");
    }

    categories
  }

  /// Generate test timeout based on function complexity
  pub fn calculate_test_timeout(function: &PactFunction) -> u32 {
    let base_timeout = 1000; // 1 second base
    let param_penalty = function.parameters.len() as u32 * 100;
    let complexity_penalty = if has_side_effects(function) { 500 } else { 0 };
    let defpact_penalty = if !function.is_defun { 2000 } else { 0 };

    base_timeout + param_penalty + complexity_penalty + defpact_penalty
  }
}

/// NAPI-exposed function to generate tests
#[napi]
pub async fn generate_tests_for_modules(
  modules: Vec<PactModule>,
  options: TestGenOptions,
) -> Result<TestGenerationResult, napi::Error> {
  tokio::task::spawn_blocking(move || {
    let generator = TestGeneratorFactory::create(&options.framework)
      .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let test_suite = generator
      .generate_tests(&modules, &options)
      .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let setup = generator
      .generate_setup(&options)
      .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let dependencies = generator.get_dependencies(&options);

    Ok(TestGenerationResult {
      tests: test_suite.tests,
      mocks: test_suite.mocks,
      fixtures: test_suite.fixtures,
      helpers: test_suite.helpers,
      integration_tests: test_suite
        .integration_tests
        .into_iter()
        .map(|t| IntegrationTestResult {
          name: t.name,
          content: t.content,
          description: t.description,
        })
        .collect(),
      property_tests: test_suite.property_tests,
      setup_config: setup.config,
      setup_config_file: setup.config_file,
      setup_script: setup.setup_script,
      env_file: setup.env_file,
      dependencies: dependencies
        .into_iter()
        .map(|d| DependencyInfo {
          name: d.name,
          version: d.version,
          dev: d.dev,
          optional: d.optional,
        })
        .collect(),
    })
  })
  .await
  .map_err(|e| napi::Error::from_reason(e.to_string()))?
}

/// Test generation result for NAPI
#[napi(object)]
pub struct TestGenerationResult {
  pub tests: String,
  pub mocks: Option<String>,
  pub fixtures: Option<String>,
  pub helpers: Option<String>,
  pub integration_tests: Vec<IntegrationTestResult>,
  pub property_tests: Option<String>,
  pub setup_config: String,
  pub setup_config_file: String,
  pub setup_script: Option<String>,
  pub env_file: Option<String>,
  pub dependencies: Vec<DependencyInfo>,
}

/// Integration test result for NAPI
#[napi(object)]
pub struct IntegrationTestResult {
  pub name: String,
  pub content: String,
  pub description: Option<String>,
}

/// Dependency information for NAPI
#[napi(object)]
pub struct DependencyInfo {
  pub name: String,
  pub version: String,
  pub dev: bool,
  pub optional: bool,
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::ast::{PactFunction, PactParameter};

  #[test]
  fn test_generator_factory() {
    assert!(TestGeneratorFactory::create("jest").is_ok());
    assert!(TestGeneratorFactory::create("vitest").is_ok());
    assert!(TestGeneratorFactory::create("mocha").is_ok());
    assert!(TestGeneratorFactory::create("ava").is_ok());
    assert!(TestGeneratorFactory::create("unknown").is_err());
  }

  #[test]
  fn test_should_have_integration_test() {
    let function_with_insert = PactFunction {
      name: "create-user".to_string(),
      doc: None,
      parameters: vec![],
      return_type: Some("string".to_string()),
      body: "(insert users ...)".to_string(),
      is_defun: true,
    };

    assert!(utils::should_have_integration_test(&function_with_insert));

    let pure_function = PactFunction {
      name: "calculate".to_string(),
      doc: None,
      parameters: vec![],
      return_type: Some("decimal".to_string()),
      body: "(+ 1 2)".to_string(),
      is_defun: true,
    };

    assert!(!utils::should_have_integration_test(&pure_function));
  }

  #[test]
  fn test_calculate_timeout() {
    let simple = PactFunction {
      name: "simple".to_string(),
      doc: None,
      parameters: vec![],
      return_type: Some("string".to_string()),
      body: "result".to_string(),
      is_defun: true,
    };

    assert_eq!(utils::calculate_test_timeout(&simple), 1000);

    let complex = PactFunction {
      name: "complex".to_string(),
      doc: None,
      parameters: vec![
        PactParameter {
          name: "a".to_string(),
          parameter_type: Some("string".to_string()),
        },
        PactParameter {
          name: "b".to_string(),
          parameter_type: Some("string".to_string()),
        },
      ],
      return_type: Some("string".to_string()),
      body: "(insert table ...)".to_string(),
      is_defun: true,
    };

    // 1000 base + 200 params + 500 side effects = 1700
    assert_eq!(utils::calculate_test_timeout(&complex), 1700);
  }
}
