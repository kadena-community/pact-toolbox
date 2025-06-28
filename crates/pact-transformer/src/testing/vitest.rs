use super::{
  utils, IntegrationTest, TestDependency, TestGenOptions, TestGenerator, TestSetup, TestSuite,
};
use crate::ast::{PactFunction, PactModule};
use anyhow::Result;
use std::fmt::Write;

/// Vitest test generator
pub struct VitestGenerator {
  /// Use React Testing Library
  use_react_testing_library: bool,
  /// Use Vue Test Utils
  use_vue_test_utils: bool,
}

impl VitestGenerator {
  pub fn new() -> Self {
    Self {
      use_react_testing_library: false,
      use_vue_test_utils: false,
    }
  }

  fn generate_test_file(&self, modules: &[PactModule], options: &TestGenOptions) -> Result<String> {
    let mut test = String::new();
    let typescript = options.typescript.unwrap_or(true);

    // Imports
    writeln!(
      &mut test,
      "import {{ describe, it, expect, beforeEach, afterEach, vi }} from 'vitest';"
    )?;

    if options.property_tests.unwrap_or(false) {
      writeln!(&mut test, "import {{ fc }} from 'fast-check';")?;
    }

    if options.snapshot_tests.unwrap_or(false) {
      writeln!(
        &mut test,
        "import {{ toMatchSnapshot }} from '@vitest/snapshot';"
      )?;
    }

    // Import modules under test
    for module in modules {
      writeln!(
        &mut test,
        "import * as {} from '../src/{}';\n",
        module.name, module.name
      )?;
    }

    // Import mocks and fixtures if generated
    if options.generate_mocks.unwrap_or(true) {
      writeln!(&mut test, "import {{ mocks, createMock }} from './mocks';")?;
    }

    if options.generate_fixtures.unwrap_or(true) {
      writeln!(&mut test, "import {{ fixtures }} from './fixtures';\n")?;
    }

    // Generate test suites for each module
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

    writeln!(
      &mut tests,
      "describe('{}', () => {{",
      utils::generate_describe_name(&module.name)
    )?;

    // Setup and teardown
    writeln!(&mut tests, "  beforeEach(() => {{")?;
    writeln!(&mut tests, "    // Reset mocks")?;
    writeln!(&mut tests, "    vi.clearAllMocks();")?;
    writeln!(&mut tests, "  }});\n")?;

    // Generate tests for each function
    for function in &module.functions {
      tests.push_str(&self.generate_function_tests(function, module, options, typescript)?);
    }

    writeln!(&mut tests, "}});")?;

    Ok(tests)
  }

  fn generate_function_tests(
    &self,
    function: &PactFunction,
    module: &PactModule,
    options: &TestGenOptions,
    typescript: bool,
  ) -> Result<String> {
    let mut tests = String::new();
    let function_name = to_camel_case(&function.name);

    writeln!(&mut tests, "  describe('{}', () => {{", function_name)?;

    // Get test categories
    let categories = utils::get_test_categories(function);

    // Happy path test
    if categories.contains(&"happy-path") {
      tests.push_str(&self.generate_happy_path_test(function, module, typescript)?);
    }

    // Input validation tests
    if categories.contains(&"input-validation") && !function.parameters.is_empty() {
      tests.push_str(&self.generate_input_validation_tests(function, module, typescript)?);
    }

    // Return type test
    if categories.contains(&"return-type") {
      tests.push_str(&self.generate_return_type_test(function, module, typescript)?);
    }

    // Error case tests
    if categories.contains(&"error-cases") {
      tests.push_str(&self.generate_error_tests(function, module, typescript)?);
    }

    // Property-based tests
    if options.property_tests.unwrap_or(false) && !function.parameters.is_empty() {
      tests.push_str(&self.generate_property_tests(function, module, options, typescript)?);
    }

    // Snapshot tests
    if options.snapshot_tests.unwrap_or(false) {
      tests.push_str(&self.generate_snapshot_test(function, module, typescript)?);
    }

    writeln!(&mut tests, "  }});\n")?;

    Ok(tests)
  }

  fn generate_happy_path_test(
    &self,
    function: &PactFunction,
    module: &PactModule,
    typescript: bool,
  ) -> Result<String> {
    let mut test = String::new();
    let function_name = to_camel_case(&function.name);
    let timeout = utils::calculate_test_timeout(function);

    writeln!(
      &mut test,
      "    it('should execute successfully with valid inputs', async () => {{"
    )?;

    // Generate mock inputs
    if !function.parameters.is_empty() {
      writeln!(&mut test, "      // Arrange")?;
      for param in &function.parameters {
        let param_name = to_camel_case(&param.name);
        let mock_value = self.generate_mock_param(&param.parameter_type);
        writeln!(&mut test, "      const {} = {};", param_name, mock_value)?;
      }
      writeln!(&mut test)?;
    }

    // Call function
    writeln!(&mut test, "      // Act")?;
    let params = function
      .parameters
      .iter()
      .map(|p| to_camel_case(&p.name))
      .collect::<Vec<_>>()
      .join(", ");

    writeln!(
      &mut test,
      "      const result = await {}.{}({});",
      module.name, function_name, params
    )?;
    writeln!(&mut test)?;

    // Assert
    writeln!(&mut test, "      // Assert")?;
    writeln!(&mut test, "      expect(result).toBeDefined();")?;

    if let Some(return_type) = &function.return_type {
      let assertion = utils::generate_type_assertion(&function.return_type, "vitest");
      writeln!(&mut test, "      {};", assertion)?;
    }

    writeln!(&mut test, "    }}, {});", timeout)?;
    writeln!(&mut test)?;

    Ok(test)
  }

  fn generate_input_validation_tests(
    &self,
    function: &PactFunction,
    module: &PactModule,
    _typescript: bool,
  ) -> Result<String> {
    let mut tests = String::new();
    let function_name = to_camel_case(&function.name);

    writeln!(&mut tests, "    describe('input validation', () => {{")?;

    // Test missing parameters
    writeln!(
      &mut tests,
      "      it('should handle missing parameters', async () => {{"
    )?;
    writeln!(&mut tests, "        await expect(")?;
    writeln!(&mut tests, "          {}.{}()", module.name, function_name)?;
    writeln!(&mut tests, "        ).rejects.toThrow();")?;
    writeln!(&mut tests, "      }});\n")?;

    // Test invalid types for each parameter
    for param in &function.parameters {
      let param_name = to_camel_case(&param.name);
      let invalid_value = self.generate_invalid_value(&param.parameter_type);

      writeln!(
        &mut tests,
        "      it('should reject invalid {} parameter', async () => {{",
        param_name
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

      writeln!(&mut tests, "        await expect(")?;
      writeln!(
        &mut tests,
        "          {}.{}({})",
        module.name,
        function_name,
        params.join(", ")
      )?;
      writeln!(&mut tests, "        ).rejects.toThrow();")?;
      writeln!(&mut tests, "      }});\n")?;
    }

    writeln!(&mut tests, "    }});\n")?;

    Ok(tests)
  }

  fn generate_return_type_test(
    &self,
    function: &PactFunction,
    module: &PactModule,
    typescript: bool,
  ) -> Result<String> {
    let mut test = String::new();
    let function_name = to_camel_case(&function.name);

    writeln!(
      &mut test,
      "    it('should return correct type', async () => {{"
    )?;

    // Generate valid inputs
    let params: Vec<String> = function
      .parameters
      .iter()
      .map(|p| self.generate_mock_param(&p.parameter_type))
      .collect();

    writeln!(
      &mut test,
      "      const result = await {}.{}({});",
      module.name,
      function_name,
      params.join(", ")
    )?;

    if let Some(return_type) = &function.return_type {
      let assertion = utils::generate_type_assertion(&function.return_type, "vitest");
      writeln!(&mut test, "      {};", assertion)?;

      // Additional assertions based on type
      match return_type.as_str() {
        "string" => {
          writeln!(&mut test, "      expect(result.length).toBeGreaterThan(0);")?;
        }
        "integer" | "decimal" => {
          writeln!(
            &mut test,
            "      expect(Number.isFinite(result)).toBe(true);"
          )?;
        }
        t if t.starts_with("[") => {
          writeln!(
            &mut test,
            "      expect(result.length).toBeGreaterThanOrEqual(0);"
          )?;
        }
        _ => {}
      }
    }

    writeln!(&mut test, "    }});\n")?;

    Ok(test)
  }

  fn generate_error_tests(
    &self,
    function: &PactFunction,
    module: &PactModule,
    _typescript: bool,
  ) -> Result<String> {
    let mut tests = String::new();
    let function_name = to_camel_case(&function.name);

    writeln!(&mut tests, "    describe('error cases', () => {{")?;

    // Network error
    writeln!(
      &mut tests,
      "      it('should handle network errors gracefully', async () => {{"
    )?;
    writeln!(&mut tests, "        // Mock network error")?;
    writeln!(
      &mut tests,
      "        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));"
    )?;
    writeln!(&mut tests)?;

    let params: Vec<String> = function
      .parameters
      .iter()
      .map(|p| self.generate_mock_param(&p.parameter_type))
      .collect();

    writeln!(&mut tests, "        await expect(")?;
    writeln!(
      &mut tests,
      "          {}.{}({})",
      module.name,
      function_name,
      params.join(", ")
    )?;
    writeln!(&mut tests, "        ).rejects.toThrow('Network error');")?;
    writeln!(&mut tests, "      }});\n")?;

    // Authorization error (if function has enforce)
    if function.body.contains("enforce") {
      writeln!(
        &mut tests,
        "      it('should handle authorization errors', async () => {{"
      )?;
      writeln!(&mut tests, "        // Mock unauthorized response")?;
      writeln!(
        &mut tests,
        "        vi.spyOn(global, 'fetch').mockResolvedValueOnce({{"
      )?;
      writeln!(&mut tests, "          ok: false,")?;
      writeln!(&mut tests, "          status: 403,")?;
      writeln!(
        &mut tests,
        "          json: async () => ({{ error: 'Unauthorized' }})"
      )?;
      writeln!(&mut tests, "        }} as Response);")?;
      writeln!(&mut tests)?;

      writeln!(&mut tests, "        await expect(")?;
      writeln!(
        &mut tests,
        "          {}.{}({})",
        module.name,
        function_name,
        params.join(", ")
      )?;
      writeln!(&mut tests, "        ).rejects.toThrow();")?;
      writeln!(&mut tests, "      }});\n")?;
    }

    writeln!(&mut tests, "    }});\n")?;

    Ok(tests)
  }

  fn generate_property_tests(
    &self,
    function: &PactFunction,
    module: &PactModule,
    options: &TestGenOptions,
    typescript: bool,
  ) -> Result<String> {
    let mut tests = String::new();
    let function_name = to_camel_case(&function.name);
    let runs = options.property_test_runs.unwrap_or(100);

    writeln!(&mut tests, "    describe('property-based tests', () => {{")?;
    writeln!(
      &mut tests,
      "      it('should handle any valid input', () => {{"
    )?;
    writeln!(&mut tests, "        fc.assert(")?;
    writeln!(&mut tests, "          fc.asyncProperty(")?;

    // Generate arbitraries for each parameter
    let mut arbitraries = Vec::new();
    for param in &function.parameters {
      let arb = self.generate_arbitrary(&param.parameter_type);
      arbitraries.push(format!("            {}", arb));
    }
    writeln!(&mut tests, "{},", arbitraries.join(",\n"))?;

    // Property function
    let param_names: Vec<String> = function
      .parameters
      .iter()
      .map(|p| to_camel_case(&p.name))
      .collect();

    writeln!(
      &mut tests,
      "            async ({}) => {{",
      param_names.join(", ")
    )?;
    writeln!(
      &mut tests,
      "              const result = await {}.{}({});",
      module.name,
      function_name,
      param_names.join(", ")
    )?;
    writeln!(&mut tests, "              expect(result).toBeDefined();")?;

    if let Some(return_type) = &function.return_type {
      let assertion = utils::generate_type_assertion(&function.return_type, "vitest");
      writeln!(&mut tests, "              {};", assertion)?;
    }

    writeln!(&mut tests, "            }}")?;
    writeln!(&mut tests, "          ),")?;
    writeln!(&mut tests, "          {{ numRuns: {} }}", runs)?;
    writeln!(&mut tests, "        );")?;
    writeln!(&mut tests, "      }});")?;
    writeln!(&mut tests, "    }});\n")?;

    Ok(tests)
  }

  fn generate_snapshot_test(
    &self,
    function: &PactFunction,
    module: &PactModule,
    _typescript: bool,
  ) -> Result<String> {
    let mut test = String::new();
    let function_name = to_camel_case(&function.name);

    writeln!(&mut test, "    it('should match snapshot', async () => {{")?;

    // Use fixtures for consistent snapshots
    let params: Vec<String> = function
      .parameters
      .iter()
      .enumerate()
      .map(|(i, p)| {
        if p.parameter_type.as_deref() == Some("string") {
          format!("'snapshot-{}-{}'", p.name, i)
        } else {
          self.generate_mock_param(&p.parameter_type)
        }
      })
      .collect();

    writeln!(
      &mut test,
      "      const result = await {}.{}({});",
      module.name,
      function_name,
      params.join(", ")
    )?;
    writeln!(&mut test, "      expect(result).toMatchSnapshot();")?;
    writeln!(&mut test, "    }});\n")?;

    Ok(test)
  }

  fn generate_mock_param(&self, param_type: &Option<String>) -> String {
    match param_type.as_deref() {
      Some("string") => "'test-string'".to_string(),
      Some("integer") => "42".to_string(),
      Some("decimal") => "3.14".to_string(),
      Some("bool") => "true".to_string(),
      Some("time") => "new Date().toISOString()".to_string(),
      Some(t) if t.starts_with("object{") => "fixtures.mockObject".to_string(),
      Some(t) if t.starts_with("[") => "[]".to_string(),
      _ => "null".to_string(),
    }
  }

  fn generate_invalid_value(&self, param_type: &Option<String>) -> String {
    match param_type.as_deref() {
      Some("string") => "123".to_string(), // number instead of string
      Some("integer") => "'not-a-number'".to_string(),
      Some("decimal") => "'invalid'".to_string(),
      Some("bool") => "'yes'".to_string(), // string instead of bool
      Some("time") => "'invalid-date'".to_string(),
      _ => "undefined".to_string(),
    }
  }

  fn generate_arbitrary(&self, param_type: &Option<String>) -> String {
    match param_type.as_deref() {
      Some("string") => "fc.string()".to_string(),
      Some("integer") => "fc.integer()".to_string(),
      Some("decimal") => "fc.float()".to_string(),
      Some("bool") => "fc.boolean()".to_string(),
      Some("time") => "fc.date().map(d => d.toISOString())".to_string(),
      Some(t) if t.starts_with("[") => "fc.array(fc.anything())".to_string(),
      _ => "fc.anything()".to_string(),
    }
  }

  fn generate_integration_tests(
    &self,
    modules: &[PactModule],
    options: &TestGenOptions,
  ) -> Result<Vec<IntegrationTest>> {
    let mut tests = Vec::new();

    for module in modules {
      for function in &module.functions {
        if utils::should_have_integration_test(function) {
          let test = self.generate_integration_test(function, module, options)?;
          tests.push(test);
        }
      }
    }

    Ok(tests)
  }

  fn generate_integration_test(
    &self,
    function: &PactFunction,
    module: &PactModule,
    options: &TestGenOptions,
  ) -> Result<IntegrationTest> {
    let mut content = String::new();
    let function_name = to_camel_case(&function.name);

    writeln!(
      &mut content,
      "import {{ describe, it, expect, beforeAll, afterAll }} from 'vitest';"
    )?;
    writeln!(
      &mut content,
      "import {{ setupTestEnvironment, teardownTestEnvironment }} from '../test-utils';"
    )?;
    writeln!(
      &mut content,
      "import * as {} from '../../src/{}';\n",
      module.name, module.name
    )?;

    writeln!(
      &mut content,
      "describe('{} integration', () => {{",
      function.name
    )?;
    writeln!(&mut content, "  beforeAll(async () => {{")?;
    writeln!(&mut content, "    await setupTestEnvironment();")?;
    writeln!(&mut content, "  }});\n")?;

    writeln!(&mut content, "  afterAll(async () => {{")?;
    writeln!(&mut content, "    await teardownTestEnvironment();")?;
    writeln!(&mut content, "  }});\n")?;

    writeln!(
      &mut content,
      "  it('should {} with real backend', async () => {{",
      function.name.replace('-', " ")
    )?;

    // Generate test body based on function type
    if function.name.starts_with("create") || function.name.starts_with("insert") {
      writeln!(&mut content, "    // Create test data")?;
      let params: Vec<String> = function
        .parameters
        .iter()
        .map(|p| self.generate_mock_param(&p.parameter_type))
        .collect();

      writeln!(
        &mut content,
        "    const result = await {}.{}({});",
        module.name,
        function_name,
        params.join(", ")
      )?;
      writeln!(&mut content, "    expect(result).toBeDefined();")?;
      writeln!(&mut content)?;
      writeln!(&mut content, "    // Verify creation")?;
      writeln!(
        &mut content,
        "    const created = await {}.get{}(result);",
        module.name,
        to_pascal_case(&module.name)
      )?;
      writeln!(&mut content, "    expect(created).toBeDefined();")?;
    } else {
      let params: Vec<String> = function
        .parameters
        .iter()
        .map(|p| self.generate_mock_param(&p.parameter_type))
        .collect();

      writeln!(
        &mut content,
        "    const result = await {}.{}({});",
        module.name,
        function_name,
        params.join(", ")
      )?;
      writeln!(&mut content, "    expect(result).toBeDefined();")?;
    }

    writeln!(
      &mut content,
      "  }}, 30000); // 30 second timeout for integration tests"
    )?;
    writeln!(&mut content, "}});")?;

    Ok(IntegrationTest {
      name: format!(
        "{}.integration.test.{}",
        function.name,
        self.file_extension(options.typescript.unwrap_or(true))
      ),
      content,
      description: Some(format!("Integration test for {} function", function.name)),
    })
  }
}

impl TestGenerator for VitestGenerator {
  fn name(&self) -> &'static str {
    "vitest"
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

    let integration_tests = if options.integration_tests.unwrap_or(false) {
      self.generate_integration_tests(modules, options)?
    } else {
      Vec::new()
    };

    Ok(TestSuite {
      tests,
      mocks: None,    // Generated separately by mocks module
      fixtures: None, // Generated separately by mocks module
      helpers: Some(self.generate_test_helpers(options)?),
      integration_tests,
      property_tests: None, // Included in main tests
    })
  }

  fn generate_setup(&self, options: &TestGenOptions) -> Result<TestSetup> {
    let typescript = options.typescript.unwrap_or(true);
    let ext = if typescript { "ts" } else { "js" };

    let config = format!(
      r#"import {{ defineConfig }} from 'vitest/config';

export default defineConfig({{
  test: {{
    globals: true,
    environment: 'node',
    setupFiles: ['./test-setup.{}'],
    coverage: {{
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{{js,ts}}'],
      exclude: ['**/*.test.{{js,ts}}', '**/*.spec.{{js,ts}}']
    }},
    testTimeout: {},
    hookTimeout: 10000,
  }},
}});"#,
      ext,
      options.timeout.unwrap_or(5000)
    );

    let setup_script = r#"import { beforeAll, afterAll, beforeEach } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Setup test environment
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Cleanup
  console.log('Cleaning up test environment...');
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
});"#
      .to_string();

    Ok(TestSetup {
      config,
      config_file: "vitest.config.js".to_string(),
      setup_script: Some(setup_script),
      env_file: Some(".env.test".to_string()),
    })
  }

  fn get_dependencies(&self, options: &TestGenOptions) -> Vec<TestDependency> {
    let mut deps = vec![
      TestDependency {
        name: "vitest".to_string(),
        version: "^1.0.0".to_string(),
        dev: true,
        optional: false,
      },
      TestDependency {
        name: "@vitest/ui".to_string(),
        version: "^1.0.0".to_string(),
        dev: true,
        optional: true,
      },
    ];

    if options.typescript.unwrap_or(true) {
      deps.push(TestDependency {
        name: "@types/node".to_string(),
        version: "^20.0.0".to_string(),
        dev: true,
        optional: false,
      });
    }

    if options.property_tests.unwrap_or(false) {
      deps.push(TestDependency {
        name: "fast-check".to_string(),
        version: "^3.0.0".to_string(),
        dev: true,
        optional: false,
      });
    }

    if options.snapshot_tests.unwrap_or(false) {
      deps.push(TestDependency {
        name: "@vitest/snapshot".to_string(),
        version: "^1.0.0".to_string(),
        dev: true,
        optional: false,
      });
    }

    deps
  }
}

impl VitestGenerator {
  fn generate_test_helpers(&self, options: &TestGenOptions) -> Result<String> {
    let mut helpers = String::new();
    let typescript = options.typescript.unwrap_or(true);

    writeln!(&mut helpers, "// Test helper utilities\n")?;

    writeln!(
      &mut helpers,
      "export async function setupTestEnvironment(){} {{",
      if typescript { ": Promise<void>" } else { "" }
    )?;
    writeln!(&mut helpers, "  // Setup test database, mocks, etc.")?;
    writeln!(&mut helpers, "  process.env.NODE_ENV = 'test';")?;
    writeln!(&mut helpers, "}}\n")?;

    writeln!(
      &mut helpers,
      "export async function teardownTestEnvironment(){} {{",
      if typescript { ": Promise<void>" } else { "" }
    )?;
    writeln!(&mut helpers, "  // Cleanup after tests")?;
    writeln!(&mut helpers, "}}\n")?;

    writeln!(
      &mut helpers,
      "export function mockPactResponse{}(data{}) {{",
      if typescript { "<T>" } else { "" },
      if typescript { ": T" } else { "" }
    )?;
    writeln!(&mut helpers, "  return {{")?;
    writeln!(&mut helpers, "    result: {{")?;
    writeln!(&mut helpers, "      status: 'success',")?;
    writeln!(&mut helpers, "      data,")?;
    writeln!(&mut helpers, "    }},")?;
    writeln!(&mut helpers, "  }};")?;
    writeln!(&mut helpers, "}}\n")?;

    writeln!(
      &mut helpers,
      "export function mockPactError(message{}) {{",
      if typescript { ": string" } else { "" }
    )?;
    writeln!(&mut helpers, "  return {{")?;
    writeln!(&mut helpers, "    result: {{")?;
    writeln!(&mut helpers, "      status: 'failure',")?;
    writeln!(&mut helpers, "      error: message,")?;
    writeln!(&mut helpers, "    }},")?;
    writeln!(&mut helpers, "  }};")?;
    writeln!(&mut helpers, "}}")?;

    Ok(helpers)
  }
}

impl Default for VitestGenerator {
  fn default() -> Self {
    Self::new()
  }
}

// Helper functions
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

fn to_pascal_case(s: &str) -> String {
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

#[cfg(test)]
mod tests {
  use super::*;
  use crate::ast::{PactFunction, PactParameter};

  #[test]
  fn test_vitest_generator() {
    let generator = VitestGenerator::new();
    assert_eq!(generator.name(), "vitest");
    assert_eq!(generator.file_extension(true), "test.ts");
    assert_eq!(generator.file_extension(false), "test.js");
  }

  #[test]
  fn test_mock_param_generation() {
    let generator = VitestGenerator::new();

    assert_eq!(
      generator.generate_mock_param(&Some("string".to_string())),
      "'test-string'"
    );
    assert_eq!(
      generator.generate_mock_param(&Some("integer".to_string())),
      "42"
    );
    assert_eq!(
      generator.generate_mock_param(&Some("bool".to_string())),
      "true"
    );
  }
}
