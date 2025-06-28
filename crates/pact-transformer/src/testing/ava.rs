use super::{utils, TestDependency, TestGenOptions, TestGenerator, TestSetup, TestSuite};
use crate::ast::{PactFunction, PactModule};
use anyhow::Result;
use std::fmt::Write;

/// AVA test generator
pub struct AvaGenerator;

impl AvaGenerator {
  pub fn new() -> Self {
    Self
  }

  fn generate_test_file(&self, modules: &[PactModule], options: &TestGenOptions) -> Result<String> {
    let mut test = String::new();
    let typescript = options.typescript.unwrap_or(true);

    // Imports
    writeln!(&mut test, "import test from 'ava';")?;

    if options.property_tests.unwrap_or(false) {
      writeln!(&mut test, "import * as fc from 'fast-check';")?;
    }

    // Import modules under test
    for module in modules {
      writeln!(
        &mut test,
        "import * as {} from '../src/{}.js';\n",
        module.name, module.name
      )?;
    }

    // Import test utilities
    if options.generate_mocks.unwrap_or(true) {
      writeln!(
        &mut test,
        "import {{ mocks, createMock }} from './mocks.js';"
      )?;
    }

    if options.generate_fixtures.unwrap_or(true) {
      writeln!(&mut test, "import {{ fixtures }} from './fixtures.js';\n")?;
    }

    // Generate tests for all modules
    for module in modules {
      test.push_str(&self.generate_module_tests(module, options, typescript)?);
      test.push('\n');
    }

    Ok(test)
  }

  fn generate_module_tests(
    &self,
    module: &PactModule,
    options: &TestGenOptions,
    typescript: bool,
  ) -> Result<String> {
    let mut tests = String::new();

    writeln!(&mut tests, "// Tests for {} module\n", module.name)?;

    // AVA doesn't use describe blocks, so we'll use comments and test naming
    for function in &module.functions {
      tests.push_str(&self.generate_function_tests(function, module, options, typescript)?);
    }

    Ok(tests)
  }

  fn generate_function_tests(
    &self,
    function: &PactFunction,
    module: &PactModule,
    options: &TestGenOptions,
    _typescript: bool,
  ) -> Result<String> {
    let mut tests = String::new();
    let function_name = to_camel_case(&function.name);
    let module_prefix = format!("{} > {}", module.name, function_name);

    writeln!(&mut tests, "// Tests for {} function", function.name)?;

    // Get test categories
    let categories = utils::get_test_categories(function);

    // Happy path test
    if categories.contains(&"happy-path") {
      tests.push_str(&self.generate_happy_path_test(function, module, &module_prefix)?);
    }

    // Input validation tests
    if categories.contains(&"input-validation") && !function.parameters.is_empty() {
      tests.push_str(&self.generate_input_validation_tests(function, module, &module_prefix)?);
    }

    // Return type test
    if categories.contains(&"return-type") {
      tests.push_str(&self.generate_return_type_test(function, module, &module_prefix)?);
    }

    // Error case tests
    if categories.contains(&"error-cases") {
      tests.push_str(&self.generate_error_tests(function, module, &module_prefix)?);
    }

    // Property-based tests
    if options.property_tests.unwrap_or(false) && !function.parameters.is_empty() {
      tests.push_str(&self.generate_property_tests(function, module, options, &module_prefix)?);
    }

    // Snapshot tests
    if options.snapshot_tests.unwrap_or(false) {
      tests.push_str(&self.generate_snapshot_test(function, module, &module_prefix)?);
    }

    writeln!(&mut tests)?;

    Ok(tests)
  }

  fn generate_happy_path_test(
    &self,
    function: &PactFunction,
    module: &PactModule,
    prefix: &str,
  ) -> Result<String> {
    let mut test = String::new();
    let function_name = to_camel_case(&function.name);

    writeln!(
      &mut test,
      "test('{} > should execute successfully with valid inputs', async t => {{",
      prefix
    )?;

    // Generate mock inputs
    if !function.parameters.is_empty() {
      writeln!(&mut test, "  // Arrange")?;
      for param in &function.parameters {
        let param_name = to_camel_case(&param.name);
        let mock_value = self.generate_mock_param(&param.parameter_type);
        writeln!(&mut test, "  const {} = {};", param_name, mock_value)?;
      }
      writeln!(&mut test)?;
    }

    // Call function
    writeln!(&mut test, "  // Act")?;
    let params = function
      .parameters
      .iter()
      .map(|p| to_camel_case(&p.name))
      .collect::<Vec<_>>()
      .join(", ");

    writeln!(
      &mut test,
      "  const result = await {}.{}({});",
      module.name, function_name, params
    )?;
    writeln!(&mut test)?;

    // Assert
    writeln!(&mut test, "  // Assert")?;
    writeln!(&mut test, "  t.truthy(result);")?;

    if let Some(return_type) = &function.return_type {
      let assertion = utils::generate_type_assertion(&function.return_type, "ava");
      writeln!(&mut test, "  {};", assertion)?;
    }

    writeln!(&mut test, "}});\n")?;

    Ok(test)
  }

  fn generate_input_validation_tests(
    &self,
    function: &PactFunction,
    module: &PactModule,
    prefix: &str,
  ) -> Result<String> {
    let mut tests = String::new();
    let function_name = to_camel_case(&function.name);

    // Test missing parameters
    writeln!(
      &mut tests,
      "test('{} > should throw when parameters are missing', async t => {{",
      prefix
    )?;
    writeln!(&mut tests, "  await t.throwsAsync(")?;
    writeln!(&mut tests, "    {}.{}(),", module.name, function_name)?;
    writeln!(&mut tests, "    {{ instanceOf: Error }}")?;
    writeln!(&mut tests, "  );")?;
    writeln!(&mut tests, "}});\n")?;

    // Test invalid types for each parameter
    for param in &function.parameters {
      let param_name = to_camel_case(&param.name);
      let invalid_value = self.generate_invalid_value(&param.parameter_type);

      writeln!(
        &mut tests,
        "test('{} > should reject invalid {} parameter', async t => {{",
        prefix, param_name
      )?;

      // Generate valid values for other params
      let params: Vec<String> = function
        .parameters
        .iter()
        .map(|p| {
          if p.name == param.name {
            invalid_value.clone()
          } else {
            self.generate_mock_param(&p.parameter_type)
          }
        })
        .collect();

      writeln!(&mut tests, "  await t.throwsAsync(")?;
      writeln!(
        &mut tests,
        "    {}.{}({}),",
        module.name,
        function_name,
        params.join(", ")
      )?;
      writeln!(&mut tests, "    {{ instanceOf: Error }}")?;
      writeln!(&mut tests, "  );")?;
      writeln!(&mut tests, "}});\n")?;
    }

    Ok(tests)
  }

  fn generate_return_type_test(
    &self,
    function: &PactFunction,
    module: &PactModule,
    prefix: &str,
  ) -> Result<String> {
    let mut test = String::new();
    let function_name = to_camel_case(&function.name);

    writeln!(
      &mut test,
      "test('{} > should return correct type', async t => {{",
      prefix
    )?;

    // Generate valid inputs
    let params: Vec<String> = function
      .parameters
      .iter()
      .map(|p| self.generate_mock_param(&p.parameter_type))
      .collect();

    writeln!(
      &mut test,
      "  const result = await {}.{}({});",
      module.name,
      function_name,
      params.join(", ")
    )?;

    if let Some(return_type) = &function.return_type {
      let assertion = utils::generate_type_assertion(&function.return_type, "ava");
      writeln!(&mut test, "  {};", assertion)?;

      // Additional AVA-specific assertions
      match return_type.as_str() {
        "string" => {
          writeln!(&mut test, "  t.true(result.length > 0);")?;
        }
        "integer" => {
          writeln!(&mut test, "  t.true(Number.isInteger(result));")?;
        }
        "decimal" => {
          writeln!(&mut test, "  t.true(Number.isFinite(result));")?;
        }
        t if t.starts_with("[") => {
          writeln!(&mut test, "  t.true(result.length >= 0);")?;
        }
        t if t.starts_with("object{") => {
          writeln!(&mut test, "  t.not(result, null);")?;
          writeln!(&mut test, "  t.not(result, undefined);")?;
        }
        _ => {}
      }
    }

    writeln!(&mut test, "}});\n")?;

    Ok(test)
  }

  fn generate_error_tests(
    &self,
    function: &PactFunction,
    module: &PactModule,
    prefix: &str,
  ) -> Result<String> {
    let mut tests = String::new();
    let function_name = to_camel_case(&function.name);

    // Network error
    writeln!(
      &mut tests,
      "test('{} > should handle network errors', async t => {{",
      prefix
    )?;
    writeln!(&mut tests, "  // Mock network failure")?;
    writeln!(&mut tests, "  const originalFetch = global.fetch;")?;
    writeln!(
      &mut tests,
      "  global.fetch = () => Promise.reject(new Error('Network error'));"
    )?;
    writeln!(&mut tests)?;

    let params: Vec<String> = function
      .parameters
      .iter()
      .map(|p| self.generate_mock_param(&p.parameter_type))
      .collect();

    writeln!(&mut tests, "  await t.throwsAsync(")?;
    writeln!(
      &mut tests,
      "    {}.{}({}),",
      module.name,
      function_name,
      params.join(", ")
    )?;
    writeln!(&mut tests, "    {{ message: 'Network error' }}")?;
    writeln!(&mut tests, "  );")?;
    writeln!(&mut tests)?;
    writeln!(&mut tests, "  // Restore fetch")?;
    writeln!(&mut tests, "  global.fetch = originalFetch;")?;
    writeln!(&mut tests, "}});\n")?;

    // Server error
    writeln!(
      &mut tests,
      "test('{} > should handle server errors', async t => {{",
      prefix
    )?;
    writeln!(&mut tests, "  // Mock server error")?;
    writeln!(&mut tests, "  const originalFetch = global.fetch;")?;
    writeln!(&mut tests, "  global.fetch = () => Promise.resolve({{")?;
    writeln!(&mut tests, "    ok: false,")?;
    writeln!(&mut tests, "    status: 500,")?;
    writeln!(
      &mut tests,
      "    json: async () => ({{ error: 'Server error' }})"
    )?;
    writeln!(&mut tests, "  }});")?;
    writeln!(&mut tests)?;

    writeln!(&mut tests, "  await t.throwsAsync(")?;
    writeln!(
      &mut tests,
      "    {}.{}({}),",
      module.name,
      function_name,
      params.join(", ")
    )?;
    writeln!(&mut tests, "    {{ instanceOf: Error }}")?;
    writeln!(&mut tests, "  );")?;
    writeln!(&mut tests)?;
    writeln!(&mut tests, "  // Restore fetch")?;
    writeln!(&mut tests, "  global.fetch = originalFetch;")?;
    writeln!(&mut tests, "}});\n")?;

    Ok(tests)
  }

  fn generate_property_tests(
    &self,
    function: &PactFunction,
    module: &PactModule,
    options: &TestGenOptions,
    prefix: &str,
  ) -> Result<String> {
    let mut tests = String::new();
    let function_name = to_camel_case(&function.name);
    let runs = options.property_test_runs.unwrap_or(100);

    writeln!(
      &mut tests,
      "test('{} > property test - should handle arbitrary valid inputs', async t => {{",
      prefix
    )?;
    writeln!(&mut tests, "  await fc.assert(")?;
    writeln!(&mut tests, "    fc.asyncProperty(")?;

    // Generate arbitraries
    for param in &function.parameters {
      let arb = self.generate_arbitrary(&param.parameter_type);
      writeln!(&mut tests, "      {},", arb)?;
    }

    // Property function
    let param_names: Vec<String> = function
      .parameters
      .iter()
      .map(|p| to_camel_case(&p.name))
      .collect();

    writeln!(&mut tests, "      async ({}) => {{", param_names.join(", "))?;
    writeln!(
      &mut tests,
      "        const result = await {}.{}({});",
      module.name,
      function_name,
      param_names.join(", ")
    )?;
    writeln!(&mut tests, "        t.truthy(result);")?;

    if let Some(return_type) = &function.return_type {
      let assertion = utils::generate_type_assertion(&function.return_type, "ava")
        .replace("t.is", "        t.is")
        .replace("t.true", "        t.true");
      writeln!(&mut tests, "{};", assertion)?;
    }

    writeln!(&mut tests, "      }}")?;
    writeln!(&mut tests, "    ),")?;
    writeln!(&mut tests, "    {{ numRuns: {}, verbose: true }}", runs)?;
    writeln!(&mut tests, "  );")?;
    writeln!(&mut tests, "}});\n")?;

    Ok(tests)
  }

  fn generate_snapshot_test(
    &self,
    function: &PactFunction,
    module: &PactModule,
    prefix: &str,
  ) -> Result<String> {
    let mut test = String::new();
    let function_name = to_camel_case(&function.name);

    writeln!(&mut test, "test('{} > snapshot', async t => {{", prefix)?;

    // Use deterministic inputs
    let params: Vec<String> = function
      .parameters
      .iter()
      .enumerate()
      .map(|(i, p)| match p.parameter_type.as_deref() {
        Some("string") => format!("'snapshot-{}'", i),
        Some("integer") => i.to_string(),
        Some("decimal") => format!("{}.0", i),
        Some("bool") => (i % 2 == 0).to_string(),
        _ => "null".to_string(),
      })
      .collect();

    writeln!(
      &mut test,
      "  const result = await {}.{}({});",
      module.name,
      function_name,
      params.join(", ")
    )?;
    writeln!(&mut test, "  t.snapshot(result);")?;
    writeln!(&mut test, "}});\n")?;

    Ok(test)
  }

  fn generate_mock_param(&self, param_type: &Option<String>) -> String {
    match param_type.as_deref() {
      Some("string") => "'test-value'".to_string(),
      Some("integer") => "42".to_string(),
      Some("decimal") => "3.14".to_string(),
      Some("bool") => "true".to_string(),
      Some("time") => "new Date('2024-01-01').toISOString()".to_string(),
      Some(t) if t.starts_with("object{") => "fixtures.testObject".to_string(),
      Some(t) if t.starts_with("[") => "[]".to_string(),
      _ => "null".to_string(),
    }
  }

  fn generate_invalid_value(&self, param_type: &Option<String>) -> String {
    match param_type.as_deref() {
      Some("string") => "123".to_string(),
      Some("integer") => "'not-a-number'".to_string(),
      Some("decimal") => "'invalid'".to_string(),
      Some("bool") => "'yes'".to_string(),
      Some("time") => "'not-a-date'".to_string(),
      _ => "Symbol('invalid')".to_string(),
    }
  }

  fn generate_arbitrary(&self, param_type: &Option<String>) -> String {
    match param_type.as_deref() {
      Some("string") => "fc.string()".to_string(),
      Some("integer") => "fc.integer()".to_string(),
      Some("decimal") => "fc.float({ noNaN: true })".to_string(),
      Some("bool") => "fc.boolean()".to_string(),
      Some("time") => "fc.date().map(d => d.toISOString())".to_string(),
      Some(t) if t.starts_with("[") => "fc.array(fc.anything())".to_string(),
      _ => "fc.anything()".to_string(),
    }
  }
}

impl TestGenerator for AvaGenerator {
  fn name(&self) -> &'static str {
    "ava"
  }

  fn file_extension(&self, typescript: bool) -> &'static str {
    if typescript {
      "test.ts"
    } else {
      "test.js"
    }
  }

  fn generate_tests(&self, modules: &[PactModule], options: &TestGenOptions) -> Result<TestSuite> {
    let tests = self.generate_test_file(modules, options)?;

    Ok(TestSuite {
      tests,
      mocks: None,
      fixtures: None,
      helpers: Some(self.generate_test_helpers()?),
      integration_tests: Vec::new(),
      property_tests: None,
    })
  }

  fn generate_setup(&self, options: &TestGenOptions) -> Result<TestSetup> {
    let typescript = options.typescript.unwrap_or(true);

    let config = if typescript {
      r#"{
  "extensions": {
    "ts": "module"
  },
  "nodeArguments": [
    "--loader=tsx",
    "--experimental-specifier-resolution=node"
  ],
  "files": [
    "test/**/*.test.ts",
    "test/**/*.spec.ts"
  ],
  "timeout": "30s",
  "verbose": true,
  "tap": false,
  "failFast": false,
  "serial": false,
  "concurrency": 5
}"#
    } else {
      r#"{
  "files": [
    "test/**/*.test.js",
    "test/**/*.spec.js"
  ],
  "timeout": "30s",
  "verbose": true,
  "tap": false,
  "failFast": false,
  "serial": false,
  "concurrency": 5
}"#
    };

    Ok(TestSetup {
      config: config.to_string(),
      config_file: "ava.config.json".to_string(),
      setup_script: None,
      env_file: None,
    })
  }

  fn get_dependencies(&self, options: &TestGenOptions) -> Vec<TestDependency> {
    let mut deps = vec![TestDependency {
      name: "ava".to_string(),
      version: "^6.0.0".to_string(),
      dev: true,
      optional: false,
    }];

    if options.typescript.unwrap_or(true) {
      deps.extend(vec![
        TestDependency {
          name: "tsx".to_string(),
          version: "^4.0.0".to_string(),
          dev: true,
          optional: false,
        },
        TestDependency {
          name: "typescript".to_string(),
          version: "^5.0.0".to_string(),
          dev: true,
          optional: false,
        },
      ]);
    }

    if options.property_tests.unwrap_or(false) {
      deps.push(TestDependency {
        name: "fast-check".to_string(),
        version: "^3.0.0".to_string(),
        dev: true,
        optional: false,
      });
    }

    deps
  }
}

impl AvaGenerator {
  fn generate_test_helpers(&self) -> Result<String> {
    let mut helpers = String::new();

    writeln!(&mut helpers, "// AVA test helpers\n")?;

    writeln!(&mut helpers, "export const serial = (fn) => {{")?;
    writeln!(&mut helpers, "  return async (t) => {{")?;
    writeln!(&mut helpers, "    // Run test serially")?;
    writeln!(&mut helpers, "    return fn(t);")?;
    writeln!(&mut helpers, "  }};")?;
    writeln!(&mut helpers, "}};\n")?;

    writeln!(&mut helpers, "export const mockFetch = (t, response) => {{")?;
    writeln!(&mut helpers, "  const originalFetch = global.fetch;")?;
    writeln!(
      &mut helpers,
      "  global.fetch = () => Promise.resolve(response);"
    )?;
    writeln!(&mut helpers, "  t.teardown(() => {{")?;
    writeln!(&mut helpers, "    global.fetch = originalFetch;")?;
    writeln!(&mut helpers, "  }});")?;
    writeln!(&mut helpers, "}};\n")?;

    writeln!(&mut helpers, "export const withTimeout = (ms) => {{")?;
    writeln!(&mut helpers, "  return (fn) => {{")?;
    writeln!(&mut helpers, "    return async (t) => {{")?;
    writeln!(&mut helpers, "      const timeout = setTimeout(() => {{")?;
    writeln!(&mut helpers, "        t.fail('Test timed out');")?;
    writeln!(&mut helpers, "      }}, ms);")?;
    writeln!(&mut helpers, "      try {{")?;
    writeln!(&mut helpers, "        await fn(t);")?;
    writeln!(&mut helpers, "      }} finally {{")?;
    writeln!(&mut helpers, "        clearTimeout(timeout);")?;
    writeln!(&mut helpers, "      }}")?;
    writeln!(&mut helpers, "    }};")?;
    writeln!(&mut helpers, "  }};")?;
    writeln!(&mut helpers, "}};")?;

    Ok(helpers)
  }
}

impl Default for AvaGenerator {
  fn default() -> Self {
    Self::new()
  }
}

// Helper function
fn to_camel_case(s: &str) -> String {
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_ava_generator() {
    let generator = AvaGenerator::new();
    assert_eq!(generator.name(), "ava");
    assert_eq!(generator.file_extension(true), "test.ts");
    assert_eq!(generator.file_extension(false), "test.js");
  }
}
