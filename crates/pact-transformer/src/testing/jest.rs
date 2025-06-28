use super::{utils, TestDependency, TestGenOptions, TestGenerator, TestSetup, TestSuite};
use crate::ast::{PactFunction, PactModule};
use anyhow::Result;
use std::fmt::Write;

/// Jest test generator
pub struct JestGenerator {
  /// Use React Testing Library
  use_react_testing_library: bool,
  /// Use Testing Library
  use_testing_library: bool,
}

impl JestGenerator {
  pub fn new() -> Self {
    Self {
      use_react_testing_library: false,
      use_testing_library: false,
    }
  }

  fn generate_test_file(&self, modules: &[PactModule], options: &TestGenOptions) -> Result<String> {
    let mut test = String::new();
    let typescript = options.typescript.unwrap_or(true);

    // File header
    writeln!(&mut test, "// Generated tests for Pact modules\n")?;

    // Imports - Jest uses globals by default
    if options.property_tests.unwrap_or(false) {
      writeln!(&mut test, "import * as fc from 'fast-check';")?;
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

    // Jest setup
    writeln!(&mut test, "// Jest configuration")?;
    writeln!(
      &mut test,
      "jest.setTimeout({});\n",
      options.timeout.unwrap_or(5000)
    )?;

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
    writeln!(&mut tests, "    // Clear all mocks")?;
    writeln!(&mut tests, "    jest.clearAllMocks();")?;
    writeln!(&mut tests, "  }});\n")?;

    writeln!(&mut tests, "  afterEach(() => {{")?;
    writeln!(&mut tests, "    // Restore all mocks")?;
    writeln!(&mut tests, "    jest.restoreAllMocks();")?;
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

    writeln!(
      &mut test,
      "    test('should execute successfully with valid inputs', async () => {{"
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
      let assertion = utils::generate_type_assertion(&function.return_type, "jest");
      writeln!(&mut test, "      {};", assertion)?;
    }

    writeln!(&mut test, "    }});")?;
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
      "      test('should throw when parameters are missing', async () => {{"
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
        "      test('should reject invalid {} parameter', async () => {{",
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
    _typescript: bool,
  ) -> Result<String> {
    let mut test = String::new();
    let function_name = to_camel_case(&function.name);

    writeln!(
      &mut test,
      "    test('should return correct type', async () => {{"
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
      let assertion = utils::generate_type_assertion(&function.return_type, "jest");
      writeln!(&mut test, "      {};", assertion)?;

      // Additional type-specific assertions
      match return_type.as_str() {
        "string" => {
          writeln!(
            &mut test,
            "      expect(result).toHaveLength(expect.any(Number));"
          )?;
        }
        "integer" => {
          writeln!(
            &mut test,
            "      expect(Number.isInteger(result)).toBe(true);"
          )?;
        }
        "decimal" => {
          writeln!(
            &mut test,
            "      expect(Number.isFinite(result)).toBe(true);"
          )?;
        }
        t if t.starts_with("[") => {
          writeln!(
            &mut test,
            "      expect(result).toHaveLength(expect.any(Number));"
          )?;
        }
        t if t.starts_with("object{") => {
          writeln!(&mut test, "      expect(result).toHaveProperty('id');")?;
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

    writeln!(&mut tests, "    describe('error handling', () => {{")?;

    // Network error
    writeln!(
      &mut tests,
      "      test('should handle network errors', async () => {{"
    )?;
    writeln!(&mut tests, "        // Mock network failure")?;
    writeln!(
      &mut tests,
      "        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));"
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

    // Timeout error
    writeln!(
      &mut tests,
      "      test('should handle timeout', async () => {{"
    )?;
    writeln!(&mut tests, "        // Mock slow response")?;
    writeln!(&mut tests, "        jest.useFakeTimers();")?;
    writeln!(
      &mut tests,
      "        global.fetch = jest.fn(() => new Promise(() => {{}}));"
    )?;
    writeln!(&mut tests)?;

    writeln!(
      &mut tests,
      "        const promise = {}.{}({});",
      module.name,
      function_name,
      params.join(", ")
    )?;
    writeln!(&mut tests, "        jest.advanceTimersByTime(30000);")?;
    writeln!(&mut tests)?;
    writeln!(
      &mut tests,
      "        await expect(promise).rejects.toThrow();"
    )?;
    writeln!(&mut tests, "        jest.useRealTimers();")?;
    writeln!(&mut tests, "      }});\n")?;

    // Authorization error (if function has enforce)
    if function.body.contains("enforce") {
      writeln!(
        &mut tests,
        "      test('should handle authorization failures', async () => {{"
      )?;
      writeln!(&mut tests, "        // Mock 403 response")?;
      writeln!(
        &mut tests,
        "        global.fetch = jest.fn().mockResolvedValue({{"
      )?;
      writeln!(&mut tests, "          ok: false,")?;
      writeln!(&mut tests, "          status: 403,")?;
      writeln!(
        &mut tests,
        "          json: async () => ({{ error: 'Forbidden' }})"
      )?;
      writeln!(&mut tests, "        }});")?;
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

    writeln!(&mut tests, "    describe('property tests', () => {{")?;
    writeln!(
      &mut tests,
      "      test('should handle arbitrary valid inputs', () => {{"
    )?;
    writeln!(&mut tests, "        return fc.assert(")?;
    writeln!(&mut tests, "          fc.asyncProperty(")?;

    // Generate arbitraries for each parameter
    for param in &function.parameters {
      let arb = self.generate_arbitrary(&param.parameter_type);
      writeln!(&mut tests, "            {},", arb)?;
    }

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
      let assertion = utils::generate_type_assertion(&function.return_type, "jest");
      writeln!(&mut tests, "              {};", assertion)?;
    }

    writeln!(&mut tests, "            }}")?;
    writeln!(&mut tests, "          ),")?;
    writeln!(
      &mut tests,
      "          {{ numRuns: {}, verbose: true }}",
      runs
    )?;
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

    writeln!(
      &mut test,
      "    test('should match snapshot', async () => {{"
    )?;

    // Use deterministic inputs for consistent snapshots
    let params: Vec<String> = function
      .parameters
      .iter()
      .enumerate()
      .map(|(i, p)| match p.parameter_type.as_deref() {
        Some("string") => format!("'test-{}'", i),
        Some("integer") => i.to_string(),
        Some("decimal") => format!("{}.5", i),
        Some("bool") => "true".to_string(),
        _ => "null".to_string(),
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
      Some("string") => "'test-value'".to_string(),
      Some("integer") => "123".to_string(),
      Some("decimal") => "123.45".to_string(),
      Some("bool") => "true".to_string(),
      Some("time") => "new Date('2024-01-01').toISOString()".to_string(),
      Some(t) if t.starts_with("object{") => "mocks.sampleObject".to_string(),
      Some(t) if t.starts_with("[") => "[mocks.sampleItem]".to_string(),
      _ => "undefined".to_string(),
    }
  }

  fn generate_invalid_value(&self, param_type: &Option<String>) -> String {
    match param_type.as_deref() {
      Some("string") => "123".to_string(),
      Some("integer") => "'not-a-number'".to_string(),
      Some("decimal") => "NaN".to_string(),
      Some("bool") => "1".to_string(),
      Some("time") => "'not-a-date'".to_string(),
      _ => "Symbol('invalid')".to_string(),
    }
  }

  fn generate_arbitrary(&self, param_type: &Option<String>) -> String {
    match param_type.as_deref() {
      Some("string") => "fc.string({ minLength: 1, maxLength: 100 })".to_string(),
      Some("integer") => "fc.integer({ min: -1000, max: 1000 })".to_string(),
      Some("decimal") => "fc.float({ min: -1000, max: 1000, noNaN: true })".to_string(),
      Some("bool") => "fc.boolean()".to_string(),
      Some("time") => "fc.date().map(d => d.toISOString())".to_string(),
      Some(t) if t.starts_with("[") => {
        "fc.array(fc.anything(), { minLength: 0, maxLength: 10 })".to_string()
      }
      Some(t) if t.starts_with("object{") => "fc.object()".to_string(),
      _ => "fc.anything()".to_string(),
    }
  }
}

impl TestGenerator for JestGenerator {
  fn name(&self) -> &'static str {
    "jest"
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
      helpers: Some(self.generate_test_helpers(options)?),
      integration_tests: Vec::new(), // TODO: Implement integration tests
      property_tests: None,
    })
  }

  fn generate_setup(&self, options: &TestGenOptions) -> Result<TestSetup> {
    let typescript = options.typescript.unwrap_or(true);

    let config = format!(
      r#"module.exports = {{
  preset: '{}',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.{{js,ts}}',
    '**/?(*.)+(spec|test).{{js,ts}}'
  ],
  transform: {{
    '^.+\\.tsx?$': 'ts-jest'
  }},
  collectCoverageFrom: [
    'src/**/*.{{js,ts}}',
    '!src/**/*.d.ts',
    '!src/**/index.{{js,ts}}'
  ],
  coverageThreshold: {{
    global: {{
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }}
  }},
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: {}
}};"#,
      if typescript {
        "ts-jest"
      } else {
        "@jest/preset-default"
      },
      options.timeout.unwrap_or(5000)
    );

    let setup_script = r#"// Jest setup file

// Add custom matchers
expect.extend({
  toBeValidPactResponse(received) {
    const pass = received && 
                  received.result && 
                  (received.result.status === 'success' || received.result.status === 'failure');
    
    return {
      pass,
      message: () => pass
        ? 'Expected value not to be a valid Pact response'
        : 'Expected value to be a valid Pact response'
    };
  }
});

// Global test utilities
global.testUtils = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  mockPactClient: () => ({
    local: jest.fn(),
    send: jest.fn(),
    dirtyRead: jest.fn(),
    listen: jest.fn()
  })
};"#
      .to_string();

    Ok(TestSetup {
      config,
      config_file: "jest.config.js".to_string(),
      setup_script: Some(setup_script),
      env_file: Some(".env.test".to_string()),
    })
  }

  fn get_dependencies(&self, options: &TestGenOptions) -> Vec<TestDependency> {
    let mut deps = vec![
      TestDependency {
        name: "jest".to_string(),
        version: "^29.0.0".to_string(),
        dev: true,
        optional: false,
      },
      TestDependency {
        name: "@types/jest".to_string(),
        version: "^29.0.0".to_string(),
        dev: true,
        optional: false,
      },
    ];

    if options.typescript.unwrap_or(true) {
      deps.extend(vec![
        TestDependency {
          name: "ts-jest".to_string(),
          version: "^29.0.0".to_string(),
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

impl JestGenerator {
  fn generate_test_helpers(&self, _options: &TestGenOptions) -> Result<String> {
    let mut helpers = String::new();

    writeln!(&mut helpers, "// Jest test helpers\n")?;

    writeln!(&mut helpers, "export const mockFetch = (response) => {{")?;
    writeln!(
      &mut helpers,
      "  global.fetch = jest.fn().mockResolvedValue({{"
    )?;
    writeln!(&mut helpers, "    ok: true,")?;
    writeln!(&mut helpers, "    json: async () => response,")?;
    writeln!(&mut helpers, "  }});")?;
    writeln!(&mut helpers, "}};\n")?;

    writeln!(&mut helpers, "export const mockFetchError = (error) => {{")?;
    writeln!(
      &mut helpers,
      "  global.fetch = jest.fn().mockRejectedValue(error);"
    )?;
    writeln!(&mut helpers, "}};\n")?;

    writeln!(
      &mut helpers,
      "export const waitFor = async (condition, timeout = 5000) => {{"
    )?;
    writeln!(&mut helpers, "  const startTime = Date.now();")?;
    writeln!(&mut helpers, "  while (!condition()) {{")?;
    writeln!(&mut helpers, "    if (Date.now() - startTime > timeout) {{")?;
    writeln!(
      &mut helpers,
      "      throw new Error('Timeout waiting for condition');"
    )?;
    writeln!(&mut helpers, "    }}")?;
    writeln!(
      &mut helpers,
      "    await new Promise(resolve => setTimeout(resolve, 100));"
    )?;
    writeln!(&mut helpers, "  }}")?;
    writeln!(&mut helpers, "}};")?;

    Ok(helpers)
  }
}

impl Default for JestGenerator {
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_jest_generator() {
    let generator = JestGenerator::new();
    assert_eq!(generator.name(), "jest");
    assert_eq!(generator.file_extension(true), "test.ts");
    assert_eq!(generator.file_extension(false), "test.js");
  }
}
