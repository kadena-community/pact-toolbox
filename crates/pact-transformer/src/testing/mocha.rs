use super::{utils, TestDependency, TestGenOptions, TestGenerator, TestSetup, TestSuite};
use crate::ast::{PactFunction, PactModule};
use anyhow::Result;
use std::fmt::Write;

/// Mocha test generator
pub struct MochaGenerator {
  /// Use Chai assertions
  use_chai: bool,
  /// Use Sinon for mocking
  use_sinon: bool,
}

impl MochaGenerator {
  pub fn new() -> Self {
    Self {
      use_chai: true,
      use_sinon: true,
    }
  }

  fn generate_test_file(&self, modules: &[PactModule], options: &TestGenOptions) -> Result<String> {
    let mut test = String::new();
    let typescript = options.typescript.unwrap_or(true);

    // Imports
    if self.use_chai {
      writeln!(&mut test, "import {{ expect }} from 'chai';")?;
    } else {
      writeln!(&mut test, "import assert from 'assert';")?;
    }

    if self.use_sinon {
      writeln!(&mut test, "import sinon from 'sinon';")?;
    }

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

    // Import test utilities
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
      "describe('{}', function() {{",
      utils::generate_describe_name(&module.name)
    )?;

    // Set timeout for suite
    writeln!(
      &mut tests,
      "  this.timeout({});\n",
      options.timeout.unwrap_or(5000)
    )?;

    // Setup and teardown
    writeln!(&mut tests, "  beforeEach(function() {{")?;
    if self.use_sinon {
      writeln!(&mut tests, "    // Create sandbox for isolated stubs")?;
      writeln!(&mut tests, "    this.sandbox = sinon.createSandbox();")?;
    }
    writeln!(&mut tests, "  }});\n")?;

    writeln!(&mut tests, "  afterEach(function() {{")?;
    if self.use_sinon {
      writeln!(&mut tests, "    // Restore all stubs")?;
      writeln!(&mut tests, "    this.sandbox.restore();")?;
    }
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

    writeln!(&mut tests, "  describe('{}', function() {{", function_name)?;

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
      "    it('should execute successfully with valid inputs', async function() {{"
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
    if self.use_chai {
      writeln!(&mut test, "      expect(result).to.exist;")?;

      if let Some(return_type) = &function.return_type {
        let assertion = utils::generate_type_assertion(&function.return_type, "mocha");
        writeln!(&mut test, "      {};", assertion)?;
      }
    } else {
      writeln!(
        &mut test,
        "      assert(result !== undefined && result !== null);"
      )?;
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

    writeln!(&mut tests, "    context('input validation', function() {{")?;

    // Test missing parameters
    writeln!(
      &mut tests,
      "      it('should throw when parameters are missing', async function() {{"
    )?;
    if self.use_chai {
      writeln!(
        &mut tests,
        "        await expect({}.{}()).to.be.rejected;",
        module.name, function_name
      )?;
    } else {
      writeln!(&mut tests, "        await assert.rejects(async () => {{")?;
      writeln!(
        &mut tests,
        "          await {}.{}();",
        module.name, function_name
      )?;
      writeln!(&mut tests, "        }});")?;
    }
    writeln!(&mut tests, "      }});\n")?;

    // Test invalid types for each parameter
    for param in &function.parameters {
      let param_name = to_camel_case(&param.name);
      let invalid_value = self.generate_invalid_value(&param.parameter_type);

      writeln!(
        &mut tests,
        "      it('should reject invalid {} parameter', async function() {{",
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

      if self.use_chai {
        writeln!(&mut tests, "        await expect(")?;
        writeln!(
          &mut tests,
          "          {}.{}({})",
          module.name,
          function_name,
          params.join(", ")
        )?;
        writeln!(&mut tests, "        ).to.be.rejected;")?;
      } else {
        writeln!(&mut tests, "        await assert.rejects(async () => {{")?;
        writeln!(
          &mut tests,
          "          await {}.{}({});",
          module.name,
          function_name,
          params.join(", ")
        )?;
        writeln!(&mut tests, "        }});")?;
      }
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
      "    it('should return correct type', async function() {{"
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
      let assertion = utils::generate_type_assertion(&function.return_type, "mocha");
      writeln!(&mut test, "      {};", assertion)?;

      // Additional assertions
      if self.use_chai {
        match return_type.as_str() {
          "string" => {
            writeln!(&mut test, "      expect(result).to.have.length.above(0);")?;
          }
          "integer" => {
            writeln!(&mut test, "      expect(result % 1).to.equal(0);")?;
          }
          t if t.starts_with("[") => {
            writeln!(
              &mut test,
              "      expect(result).to.have.lengthOf.at.least(0);"
            )?;
          }
          _ => {}
        }
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

    writeln!(&mut tests, "    context('error handling', function() {{")?;

    // Network error
    writeln!(
      &mut tests,
      "      it('should handle network errors', async function() {{"
    )?;

    if self.use_sinon {
      writeln!(&mut tests, "        // Stub fetch to throw network error")?;
      writeln!(
        &mut tests,
        "        this.sandbox.stub(global, 'fetch').rejects(new Error('Network error'));"
      )?;
    }

    let params: Vec<String> = function
      .parameters
      .iter()
      .map(|p| self.generate_mock_param(&p.parameter_type))
      .collect();

    if self.use_chai {
      writeln!(&mut tests, "        await expect(")?;
      writeln!(
        &mut tests,
        "          {}.{}({})",
        module.name,
        function_name,
        params.join(", ")
      )?;
      writeln!(&mut tests, "        ).to.be.rejectedWith('Network error');")?;
    } else {
      writeln!(&mut tests, "        await assert.rejects(")?;
      writeln!(
        &mut tests,
        "          {}.{}({}),",
        module.name,
        function_name,
        params.join(", ")
      )?;
      writeln!(&mut tests, "          /Network error/")?;
      writeln!(&mut tests, "        );")?;
    }

    writeln!(&mut tests, "      }});\n")?;

    // Server error
    writeln!(
      &mut tests,
      "      it('should handle server errors', async function() {{"
    )?;

    if self.use_sinon {
      writeln!(&mut tests, "        // Stub fetch to return 500 error")?;
      writeln!(
        &mut tests,
        "        this.sandbox.stub(global, 'fetch').resolves({{"
      )?;
      writeln!(&mut tests, "          ok: false,")?;
      writeln!(&mut tests, "          status: 500,")?;
      writeln!(
        &mut tests,
        "          json: async () => ({{ error: 'Internal Server Error' }})"
      )?;
      writeln!(&mut tests, "        }});")?;
    }

    if self.use_chai {
      writeln!(&mut tests, "        await expect(")?;
      writeln!(
        &mut tests,
        "          {}.{}({})",
        module.name,
        function_name,
        params.join(", ")
      )?;
      writeln!(&mut tests, "        ).to.be.rejected;")?;
    } else {
      writeln!(&mut tests, "        await assert.rejects(")?;
      writeln!(
        &mut tests,
        "          {}.{}({})",
        module.name,
        function_name,
        params.join(", ")
      )?;
      writeln!(&mut tests, "        );")?;
    }

    writeln!(&mut tests, "      }});\n")?;

    writeln!(&mut tests, "    }});\n")?;

    Ok(tests)
  }

  fn generate_property_tests(
    &self,
    function: &PactFunction,
    module: &PactModule,
    options: &TestGenOptions,
    _typescript: bool,
  ) -> Result<String> {
    let mut tests = String::new();
    let function_name = to_camel_case(&function.name);
    let runs = options.property_test_runs.unwrap_or(100);

    writeln!(&mut tests, "    context('property tests', function() {{")?;
    writeln!(
      &mut tests,
      "      it('should handle arbitrary valid inputs', function() {{"
    )?;
    writeln!(&mut tests, "        return fc.assert(")?;
    writeln!(&mut tests, "          fc.asyncProperty(")?;

    // Generate arbitraries
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

    if self.use_chai {
      writeln!(&mut tests, "              expect(result).to.exist;")?;
    } else {
      writeln!(&mut tests, "              assert(result !== undefined);")?;
    }

    writeln!(&mut tests, "            }}")?;
    writeln!(&mut tests, "          ),")?;
    writeln!(&mut tests, "          {{ numRuns: {} }}", runs)?;
    writeln!(&mut tests, "        );")?;
    writeln!(&mut tests, "      }});")?;
    writeln!(&mut tests, "    }});\n")?;

    Ok(tests)
  }

  fn generate_mock_param(&self, param_type: &Option<String>) -> String {
    match param_type.as_deref() {
      Some("string") => "'test-string'".to_string(),
      Some("integer") => "42".to_string(),
      Some("decimal") => "3.14".to_string(),
      Some("bool") => "true".to_string(),
      Some("time") => "new Date().toISOString()".to_string(),
      Some(t) if t.starts_with("object{") => "fixtures.testObject".to_string(),
      Some(t) if t.starts_with("[") => "[]".to_string(),
      _ => "null".to_string(),
    }
  }

  fn generate_invalid_value(&self, param_type: &Option<String>) -> String {
    match param_type.as_deref() {
      Some("string") => "42".to_string(),
      Some("integer") => "'invalid'".to_string(),
      Some("decimal") => "'not-a-number'".to_string(),
      Some("bool") => "'true'".to_string(), // string instead of boolean
      Some("time") => "'invalid-date'".to_string(),
      _ => "undefined".to_string(),
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

impl TestGenerator for MochaGenerator {
  fn name(&self) -> &'static str {
    "mocha"
  }

  fn file_extension(&self, typescript: bool) -> &'static str {
    if typescript {
      "spec.ts"
    } else {
      "spec.js"
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

    let config = format!(
      r#"{{
  "require": [{}],
  "spec": ["test/**/*.spec.{{js,ts}}", "test/**/*.test.{{js,ts}}"],
  "timeout": {},
  "recursive": true,
  "reporter": "spec",
  "exit": true,
  "colors": true,
  "watch-extensions": ["js", "ts"],
  "node-option": ["experimental-specifier-resolution=node", "loader=ts-node/esm"]
}}"#,
      if typescript {
        r#"["ts-node/register", "chai/register-expect"]"#
      } else {
        r#"["chai/register-expect"]"#
      },
      options.timeout.unwrap_or(5000)
    );

    Ok(TestSetup {
      config,
      config_file: ".mocharc.json".to_string(),
      setup_script: None,
      env_file: None,
    })
  }

  fn get_dependencies(&self, options: &TestGenOptions) -> Vec<TestDependency> {
    let mut deps = vec![TestDependency {
      name: "mocha".to_string(),
      version: "^10.0.0".to_string(),
      dev: true,
      optional: false,
    }];

    if self.use_chai {
      deps.extend(vec![
        TestDependency {
          name: "chai".to_string(),
          version: "^4.3.0".to_string(),
          dev: true,
          optional: false,
        },
        TestDependency {
          name: "chai-as-promised".to_string(),
          version: "^7.1.0".to_string(),
          dev: true,
          optional: false,
        },
      ]);
    }

    if self.use_sinon {
      deps.push(TestDependency {
        name: "sinon".to_string(),
        version: "^17.0.0".to_string(),
        dev: true,
        optional: false,
      });
    }

    if options.typescript.unwrap_or(true) {
      deps.extend(vec![
        TestDependency {
          name: "@types/mocha".to_string(),
          version: "^10.0.0".to_string(),
          dev: true,
          optional: false,
        },
        TestDependency {
          name: "@types/chai".to_string(),
          version: "^4.3.0".to_string(),
          dev: true,
          optional: false,
        },
        TestDependency {
          name: "@types/sinon".to_string(),
          version: "^17.0.0".to_string(),
          dev: true,
          optional: false,
        },
        TestDependency {
          name: "ts-node".to_string(),
          version: "^10.0.0".to_string(),
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

impl MochaGenerator {
  fn generate_test_helpers(&self) -> Result<String> {
    let mut helpers = String::new();

    writeln!(&mut helpers, "// Mocha test helpers\n")?;

    if self.use_chai {
      writeln!(&mut helpers, "import chai from 'chai';")?;
      writeln!(
        &mut helpers,
        "import chaiAsPromised from 'chai-as-promised';"
      )?;
      writeln!(&mut helpers, "chai.use(chaiAsPromised);\n")?;
    }

    writeln!(
      &mut helpers,
      "export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));\n"
    )?;

    writeln!(
      &mut helpers,
      "export const retryAsync = async (fn, retries = 3, delay = 1000) => {{"
    )?;
    writeln!(&mut helpers, "  for (let i = 0; i < retries; i++) {{")?;
    writeln!(&mut helpers, "    try {{")?;
    writeln!(&mut helpers, "      return await fn();")?;
    writeln!(&mut helpers, "    }} catch (error) {{")?;
    writeln!(&mut helpers, "      if (i === retries - 1) throw error;")?;
    writeln!(&mut helpers, "      await delay(delay);")?;
    writeln!(&mut helpers, "    }}")?;
    writeln!(&mut helpers, "  }}")?;
    writeln!(&mut helpers, "}};")?;

    Ok(helpers)
  }
}

impl Default for MochaGenerator {
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
  fn test_mocha_generator() {
    let generator = MochaGenerator::new();
    assert_eq!(generator.name(), "mocha");
    assert_eq!(generator.file_extension(true), "spec.ts");
    assert_eq!(generator.file_extension(false), "spec.js");
  }
}
