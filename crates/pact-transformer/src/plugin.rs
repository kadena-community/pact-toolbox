use crate::ast::{PactFunction, PactModule};
use anyhow::Result;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Plugin trait for extending the transformer
pub trait TransformPlugin: Send + Sync {
  /// Get the plugin name
  fn name(&self) -> &str;

  /// Get plugin description
  fn description(&self) -> &str {
    "No description provided"
  }

  /// Initialize the plugin with options
  fn initialize(&mut self, _options: &HashMap<String, serde_json::Value>) -> Result<()> {
    Ok(())
  }

  /// Transform a module before code generation
  fn transform_module(&self, _module: &mut PactModule) -> Result<()> {
    Ok(())
  }

  /// Transform a function before code generation
  fn transform_function(&self, _function: &mut PactFunction, _module_name: &str) -> Result<()> {
    Ok(())
  }

  /// Post-process generated JavaScript code
  fn post_generate_js(&self, _code: &mut String, _modules: &[PactModule]) -> Result<()> {
    Ok(())
  }

  /// Post-process generated TypeScript types
  fn post_generate_types(&self, _types: &mut String, _modules: &[PactModule]) -> Result<()> {
    Ok(())
  }

  /// Generate additional files
  fn generate_additional_files(&self, _modules: &[PactModule]) -> Result<Vec<GeneratedFile>> {
    Ok(Vec::new())
  }
}

/// A generated file from a plugin
#[derive(Debug, Clone)]
pub struct GeneratedFile {
  pub path: String,
  pub content: String,
  pub description: Option<String>,
}

/// Plugin manager for managing and executing plugins
pub struct PluginManager {
  plugins: Vec<Box<dyn TransformPlugin>>,
  enabled_plugins: HashMap<String, bool>,
}

impl PluginManager {
  pub fn new() -> Self {
    Self {
      plugins: Vec::new(),
      enabled_plugins: HashMap::new(),
    }
  }

  /// Register a plugin
  pub fn register(&mut self, plugin: Box<dyn TransformPlugin>) {
    let name = plugin.name().to_string();
    self.plugins.push(plugin);
    self.enabled_plugins.insert(name, true);
  }

  /// Enable or disable a plugin
  pub fn set_enabled(&mut self, name: &str, enabled: bool) {
    self.enabled_plugins.insert(name.to_string(), enabled);
  }

  /// Check if a plugin is enabled
  pub fn is_enabled(&self, name: &str) -> bool {
    self.enabled_plugins.get(name).copied().unwrap_or(false)
  }

  /// Initialize all enabled plugins
  pub fn initialize_all(
    &mut self,
    options: &HashMap<String, HashMap<String, serde_json::Value>>,
  ) -> Result<()> {
    for i in 0..self.plugins.len() {
      let plugin_name = self.plugins[i].name().to_string();
      if self.is_enabled(&plugin_name) {
        let plugin_options = options.get(&plugin_name).cloned().unwrap_or_default();
        self.plugins[i].initialize(&plugin_options)?;
      }
    }
    Ok(())
  }

  /// Run module transformations
  pub fn transform_modules(&self, modules: &mut [PactModule]) -> Result<()> {
    for plugin in &self.plugins {
      if self.is_enabled(plugin.name()) {
        for module in modules.iter_mut() {
          plugin.transform_module(module)?;
        }
      }
    }
    Ok(())
  }

  /// Run function transformations
  pub fn transform_functions(&self, modules: &mut [PactModule]) -> Result<()> {
    for plugin in &self.plugins {
      if self.is_enabled(plugin.name()) {
        for module in modules.iter_mut() {
          let module_name = module.name.clone();
          for function in &mut module.functions {
            plugin.transform_function(function, &module_name)?;
          }
        }
      }
    }
    Ok(())
  }

  /// Post-process generated code
  pub fn post_generate(
    &self,
    js_code: &mut String,
    ts_types: &mut String,
    modules: &[PactModule],
  ) -> Result<()> {
    for plugin in &self.plugins {
      if self.is_enabled(plugin.name()) {
        plugin.post_generate_js(js_code, modules)?;
        plugin.post_generate_types(ts_types, modules)?;
      }
    }
    Ok(())
  }

  /// Generate additional files from all plugins
  pub fn generate_additional_files(&self, modules: &[PactModule]) -> Result<Vec<GeneratedFile>> {
    let mut all_files = Vec::new();

    for plugin in &self.plugins {
      if self.is_enabled(plugin.name()) {
        let files = plugin.generate_additional_files(modules)?;
        all_files.extend(files);
      }
    }

    Ok(all_files)
  }
}

impl Default for PluginManager {
  fn default() -> Self {
    Self::new()
  }
}

/// Built-in plugin: JSDoc Enhancer
pub struct JSDocEnhancerPlugin {
  add_examples: bool,
  add_param_descriptions: bool,
  add_returns_description: bool,
}

impl JSDocEnhancerPlugin {
  pub fn new() -> Self {
    Self {
      add_examples: true,
      add_param_descriptions: true,
      add_returns_description: true,
    }
  }
}

impl TransformPlugin for JSDocEnhancerPlugin {
  fn name(&self) -> &str {
    "jsdoc-enhancer"
  }

  fn description(&self) -> &str {
    "Enhances JSDoc comments with examples and detailed parameter descriptions"
  }

  fn initialize(&mut self, options: &HashMap<String, serde_json::Value>) -> Result<()> {
    if let Some(add_examples) = options.get("addExamples").and_then(|v| v.as_bool()) {
      self.add_examples = add_examples;
    }
    if let Some(add_params) = options
      .get("addParamDescriptions")
      .and_then(|v| v.as_bool())
    {
      self.add_param_descriptions = add_params;
    }
    if let Some(add_returns) = options
      .get("addReturnsDescription")
      .and_then(|v| v.as_bool())
    {
      self.add_returns_description = add_returns;
    }
    Ok(())
  }

  fn transform_function(&self, function: &mut PactFunction, module_name: &str) -> Result<()> {
    if let Some(doc) = &mut function.doc {
      let mut enhanced_doc = doc.clone();

      // Add parameter descriptions
      if self.add_param_descriptions && !function.parameters.is_empty() {
        enhanced_doc.push_str("\n *");
        for param in &function.parameters {
          enhanced_doc.push_str(&format!(
            "\n * @param {{{}}} {} - {}",
            param.parameter_type.as_deref().unwrap_or("any"),
            param.name,
            format!("The {} parameter", param.name)
          ));
        }
      }

      // Add returns description
      if self.add_returns_description {
        if let Some(return_type) = &function.return_type {
          enhanced_doc.push_str(&format!(
            "\n * @returns {{{}}} The result of the {} operation",
            return_type, function.name
          ));
        }
      }

      // Add example
      if self.add_examples {
        enhanced_doc.push_str("\n * @example");
        enhanced_doc.push_str(&format!(
          "\n * // Using {} from {}",
          function.name, module_name
        ));

        let params = function
          .parameters
          .iter()
          .map(|p| format!("'{}'", p.name))
          .collect::<Vec<_>>()
          .join(", ");

        enhanced_doc.push_str(&format!(
          "\n * const result = await {}({});",
          function.name, params
        ));
      }

      *doc = enhanced_doc;
    }
    Ok(())
  }
}

/// Built-in plugin: React Hooks Generator
pub struct ReactHooksGeneratorPlugin {
  use_suspense: bool,
  use_error_boundary: bool,
  typescript: bool,
}

impl ReactHooksGeneratorPlugin {
  pub fn new() -> Self {
    Self {
      use_suspense: true,
      use_error_boundary: true,
      typescript: true,
    }
  }
}

impl TransformPlugin for ReactHooksGeneratorPlugin {
  fn name(&self) -> &str {
    "react-hooks-generator"
  }

  fn description(&self) -> &str {
    "Generates React hooks for Pact functions with suspense and error boundary support"
  }

  fn initialize(&mut self, options: &HashMap<String, serde_json::Value>) -> Result<()> {
    if let Some(use_suspense) = options.get("useSuspense").and_then(|v| v.as_bool()) {
      self.use_suspense = use_suspense;
    }
    if let Some(use_error) = options.get("useErrorBoundary").and_then(|v| v.as_bool()) {
      self.use_error_boundary = use_error;
    }
    if let Some(typescript) = options.get("typescript").and_then(|v| v.as_bool()) {
      self.typescript = typescript;
    }
    Ok(())
  }

  fn generate_additional_files(&self, modules: &[PactModule]) -> Result<Vec<GeneratedFile>> {
    let mut files = Vec::new();

    for module in modules {
      let mut hooks_content = String::new();

      // Add imports
      hooks_content.push_str("import { useState, useEffect, useCallback } from 'react';\n");
      if self.use_suspense {
        hooks_content.push_str("import { useQuery, useMutation } from '@tanstack/react-query';\n");
      }
      hooks_content.push_str(&format!(
        "import * as {} from './{}';\n\n",
        module.name, module.name
      ));

      // Generate hooks for each function
      for function in &module.functions {
        let hook_name = format!("use{}", to_pascal_case(&function.name));

        if function.is_defun {
          // For read operations, generate a query hook
          let params_str = if function.parameters.is_empty() {
            String::new()
          } else {
            function
              .parameters
              .iter()
              .map(|p| {
                format!(
                  "{}: {}",
                  p.name,
                  p.parameter_type.as_deref().unwrap_or("any")
                )
              })
              .collect::<Vec<_>>()
              .join(", ")
          };

          hooks_content.push_str(&format!(
            "export function {}({}) {{\n",
            hook_name, params_str
          ));

          if self.use_suspense {
            hooks_content.push_str(&format!(
                            "  return useQuery({{\n    queryKey: ['{}', {}],\n    queryFn: () => {}.{}({}),\n  }});\n",
                            function.name,
                            function.parameters.iter().map(|p| &p.name).cloned().collect::<Vec<_>>().join(", "),
                            module.name,
                            function.name,
                            function.parameters.iter().map(|p| &p.name).cloned().collect::<Vec<_>>().join(", ")
                        ));
          } else {
            hooks_content.push_str("  const [data, setData] = useState(null);\n");
            hooks_content.push_str("  const [loading, setLoading] = useState(false);\n");
            hooks_content.push_str("  const [error, setError] = useState(null);\n\n");

            hooks_content.push_str("  useEffect(() => {\n");
            hooks_content.push_str("    const fetchData = async () => {\n");
            hooks_content.push_str("      setLoading(true);\n");
            hooks_content.push_str("      try {\n");
            hooks_content.push_str(&format!(
              "        const result = await {}.{}({});\n",
              module.name,
              function.name,
              function
                .parameters
                .iter()
                .map(|p| &p.name)
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
            ));
            hooks_content.push_str("        setData(result);\n");
            hooks_content.push_str("      } catch (err) {\n");
            hooks_content.push_str("        setError(err);\n");
            hooks_content.push_str("      } finally {\n");
            hooks_content.push_str("        setLoading(false);\n");
            hooks_content.push_str("      }\n");
            hooks_content.push_str("    };\n");
            hooks_content.push_str("    fetchData();\n");
            hooks_content.push_str("  }, [");
            hooks_content.push_str(
              &function
                .parameters
                .iter()
                .map(|p| &p.name)
                .cloned()
                .collect::<Vec<_>>()
                .join(", "),
            );
            hooks_content.push_str("]);\n\n");

            hooks_content.push_str("  return { data, loading, error };\n");
          }

          hooks_content.push_str("}\n\n");
        } else {
          // For write operations, generate a mutation hook
          hooks_content.push_str(&format!("export function {}() {{\n", hook_name));

          if self.use_suspense {
            hooks_content.push_str(&format!(
              "  return useMutation({{\n    mutationFn: ({{{}}}) => {}.{}({}),\n  }});\n",
              function
                .parameters
                .iter()
                .map(|p| &p.name)
                .cloned()
                .collect::<Vec<_>>()
                .join(", "),
              module.name,
              function.name,
              function
                .parameters
                .iter()
                .map(|p| &p.name)
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
            ));
          } else {
            hooks_content.push_str("  const [loading, setLoading] = useState(false);\n");
            hooks_content.push_str("  const [error, setError] = useState(null);\n\n");

            hooks_content.push_str(&format!(
              "  const {} = useCallback(async ({}) => {{\n",
              function.name,
              function
                .parameters
                .iter()
                .map(|p| format!(
                  "{}: {}",
                  p.name,
                  p.parameter_type.as_deref().unwrap_or("any")
                ))
                .collect::<Vec<_>>()
                .join(", ")
            ));
            hooks_content.push_str("    setLoading(true);\n");
            hooks_content.push_str("    setError(null);\n");
            hooks_content.push_str("    try {\n");
            hooks_content.push_str(&format!(
              "      const result = await {}.{}({});\n",
              module.name,
              function.name,
              function
                .parameters
                .iter()
                .map(|p| &p.name)
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
            ));
            hooks_content.push_str("      return result;\n");
            hooks_content.push_str("    } catch (err) {\n");
            hooks_content.push_str("      setError(err);\n");
            hooks_content.push_str("      throw err;\n");
            hooks_content.push_str("    } finally {\n");
            hooks_content.push_str("      setLoading(false);\n");
            hooks_content.push_str("    }\n");
            hooks_content.push_str("  }, []);\n\n");

            hooks_content.push_str(&format!(
              "  return {{ {}, loading, error }};\n",
              function.name
            ));
          }

          hooks_content.push_str("}\n\n");
        }
      }

      let file_extension = if self.typescript { "ts" } else { "js" };
      files.push(GeneratedFile {
        path: format!("{}.hooks.{}", module.name, file_extension),
        content: hooks_content,
        description: Some(format!("React hooks for {} module", module.name)),
      });
    }

    Ok(files)
  }
}

/// Built-in plugin: Mock Generator
pub struct MockGeneratorPlugin {
  use_faker: bool,
  generate_fixtures: bool,
}

impl MockGeneratorPlugin {
  pub fn new() -> Self {
    Self {
      use_faker: true,
      generate_fixtures: true,
    }
  }
}

impl TransformPlugin for MockGeneratorPlugin {
  fn name(&self) -> &str {
    "mock-generator"
  }

  fn description(&self) -> &str {
    "Generates mock data and fixtures for testing Pact contracts"
  }

  fn generate_additional_files(&self, modules: &[PactModule]) -> Result<Vec<GeneratedFile>> {
    let mut files = Vec::new();

    for module in modules {
      let mut mock_content = String::new();

      // Add imports
      if self.use_faker {
        mock_content.push_str("import { faker } from '@faker-js/faker';\n\n");
      }

      // Generate mock factories for schemas
      for schema in &module.schemas {
        mock_content.push_str(&format!(
          "export function mock{}(overrides = {{}}) {{\n",
          to_pascal_case(&schema.name)
        ));
        mock_content.push_str("  return {\n");

        for field in &schema.fields {
          let mock_value = match field.field_type.as_str() {
            "string" => {
              if self.use_faker {
                match field.name.as_str() {
                  "name" => "faker.person.fullName()".to_string(),
                  "email" => "faker.internet.email()".to_string(),
                  "address" => "faker.location.streetAddress()".to_string(),
                  "phone" => "faker.phone.number()".to_string(),
                  "url" => "faker.internet.url()".to_string(),
                  _ => format!("faker.lorem.word()"),
                }
              } else {
                format!("'mock-{}'", field.name)
              }
            }
            "integer" => {
              if self.use_faker {
                "faker.number.int({ min: 1, max: 100 })".to_string()
              } else {
                "42".to_string()
              }
            }
            "decimal" => {
              if self.use_faker {
                "faker.number.float({ min: 0, max: 100, fractionDigits: 2 })".to_string()
              } else {
                "3.14".to_string()
              }
            }
            "bool" => {
              if self.use_faker {
                "faker.datatype.boolean()".to_string()
              } else {
                "true".to_string()
              }
            }
            "time" => {
              if self.use_faker {
                "faker.date.recent().toISOString()".to_string()
              } else {
                "new Date().toISOString()".to_string()
              }
            }
            _ => "'mock-value'".to_string(),
          };

          mock_content.push_str(&format!("    {}: {},\n", field.name, mock_value));
        }

        mock_content.push_str("    ...overrides,\n");
        mock_content.push_str("  };\n");
        mock_content.push_str("}\n\n");
      }

      // Generate mock responses for functions
      for function in &module.functions {
        if let Some(return_type) = &function.return_type {
          mock_content.push_str(&format!(
            "export function mock{}Response() {{\n",
            to_pascal_case(&function.name)
          ));

          let mock_value = match return_type.as_str() {
            "string" => "'mock-response'".to_string(),
            "integer" => "42".to_string(),
            "decimal" => "3.14".to_string(),
            "bool" => "true".to_string(),
            _ => {
              // Check if it's a schema type
              if return_type.starts_with("object{") && return_type.ends_with('}') {
                let schema_name = &return_type[7..return_type.len() - 1];
                format!("mock{}()", to_pascal_case(schema_name))
              } else {
                "null".to_string()
              }
            }
          };

          mock_content.push_str(&format!("  return {};\n", mock_value));
          mock_content.push_str("}\n\n");
        }
      }

      files.push(GeneratedFile {
        path: format!("{}.mocks.js", module.name),
        content: mock_content,
        description: Some(format!("Mock data generators for {} module", module.name)),
      });

      // Generate fixtures if requested
      if self.generate_fixtures {
        let mut fixtures_content = String::new();
        fixtures_content.push_str(&format!(
          "import * as mocks from './{}.mocks';\n\n",
          module.name
        ));

        fixtures_content.push_str("export const fixtures = {\n");

        for schema in &module.schemas {
          let pascal_name = to_pascal_case(&schema.name);
          fixtures_content.push_str(&format!(
            "  {}s: [\n    mocks.mock{}(),\n    mocks.mock{}(),\n    mocks.mock{}(),\n  ],\n",
            schema.name, pascal_name, pascal_name, pascal_name
          ));
        }

        fixtures_content.push_str("};\n");

        files.push(GeneratedFile {
          path: format!("{}.fixtures.js", module.name),
          content: fixtures_content,
          description: Some(format!("Test fixtures for {} module", module.name)),
        });
      }
    }

    Ok(files)
  }
}

/// Plugin registry for built-in plugins
pub struct BuiltinPlugins;

impl BuiltinPlugins {
  /// Get all available built-in plugins
  pub fn all() -> Vec<Box<dyn TransformPlugin>> {
    vec![
      Box::new(JSDocEnhancerPlugin::new()),
      Box::new(ReactHooksGeneratorPlugin::new()),
      Box::new(MockGeneratorPlugin::new()),
    ]
  }

  /// Get a built-in plugin by name
  pub fn get(name: &str) -> Option<Box<dyn TransformPlugin>> {
    match name {
      "jsdoc-enhancer" => Some(Box::new(JSDocEnhancerPlugin::new())),
      "react-hooks-generator" => Some(Box::new(ReactHooksGeneratorPlugin::new())),
      "mock-generator" => Some(Box::new(MockGeneratorPlugin::new())),
      _ => None,
    }
  }
}

/// Global plugin manager instance
static PLUGIN_MANAGER: Mutex<Option<Arc<Mutex<PluginManager>>>> = Mutex::new(None);

/// Get or create the global plugin manager
pub fn get_plugin_manager() -> Arc<Mutex<PluginManager>> {
  let mut manager_opt = PLUGIN_MANAGER.lock().unwrap();
  if let Some(manager) = manager_opt.as_ref() {
    Arc::clone(manager)
  } else {
    let manager = Arc::new(Mutex::new(PluginManager::new()));
    *manager_opt = Some(Arc::clone(&manager));
    manager
  }
}

/// NAPI-exposed plugin configuration
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
  /// Plugin name
  pub name: String,

  /// Plugin description
  pub description: String,

  /// Whether the plugin is enabled
  pub enabled: bool,

  /// Plugin options
  pub options: Option<HashMap<String, serde_json::Value>>,
}

/// Register a built-in plugin
#[napi]
pub fn register_builtin_plugin(name: String) -> Result<bool, napi::Error> {
  if let Some(plugin) = BuiltinPlugins::get(&name) {
    let manager = get_plugin_manager();
    let mut manager_lock = manager.lock().unwrap();
    manager_lock.register(plugin);
    Ok(true)
  } else {
    Err(napi::Error::from_reason(format!(
      "Unknown built-in plugin: {}",
      name
    )))
  }
}

/// Get information about all registered plugins
#[napi]
pub fn get_registered_plugins() -> Vec<PluginInfo> {
  let manager = get_plugin_manager();
  let manager_lock = manager.lock().unwrap();

  let mut plugins = Vec::new();
  for plugin in &manager_lock.plugins {
    plugins.push(PluginInfo {
      name: plugin.name().to_string(),
      description: plugin.description().to_string(),
      enabled: manager_lock.is_enabled(plugin.name()),
      options: None,
    });
  }

  plugins
}

/// Enable or disable a plugin
#[napi]
pub fn set_plugin_enabled(name: String, enabled: bool) -> Result<(), napi::Error> {
  let manager = get_plugin_manager();
  let mut manager_lock = manager.lock().unwrap();
  manager_lock.set_enabled(&name, enabled);
  Ok(())
}

/// Initialize plugins with options
#[napi]
pub fn initialize_plugins(
  options: HashMap<String, HashMap<String, serde_json::Value>>,
) -> Result<(), napi::Error> {
  let manager = get_plugin_manager();
  let mut manager_lock = manager.lock().unwrap();
  manager_lock
    .initialize_all(&options)
    .map_err(|e| napi::Error::from_reason(e.to_string()))
}

// Helper function for case conversion
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
  use crate::ast::{PactParameter, SchemaField};

  #[test]
  fn test_plugin_manager() {
    let mut manager = PluginManager::new();
    let plugin = Box::new(JSDocEnhancerPlugin::new());

    assert_eq!(plugin.name(), "jsdoc-enhancer");
    manager.register(plugin);

    assert!(manager.is_enabled("jsdoc-enhancer"));
    manager.set_enabled("jsdoc-enhancer", false);
    assert!(!manager.is_enabled("jsdoc-enhancer"));
  }

  #[test]
  fn test_jsdoc_enhancer() {
    let plugin = JSDocEnhancerPlugin::new();

    let mut function = PactFunction {
      name: "test-function".to_string(),
      doc: Some("Test function".to_string()),
      parameters: vec![PactParameter {
        name: "amount".to_string(),
        parameter_type: Some("decimal".to_string()),
      }],
      return_type: Some("string".to_string()),
      body: "".to_string(),
      is_defun: true,
    };

    plugin
      .transform_function(&mut function, "test-module")
      .unwrap();

    let doc = function.doc.unwrap();
    assert!(doc.contains("@param {decimal} amount"));
    assert!(doc.contains("@returns {string}"));
    assert!(doc.contains("@example"));
  }

  #[test]
  fn test_react_hooks_generator() {
    let plugin = ReactHooksGeneratorPlugin::new();

    let module = PactModule {
      name: "test".to_string(),
      namespace: None,
      governance: "".to_string(),
      doc: None,
      functions: vec![PactFunction {
        name: "get-user".to_string(),
        doc: None,
        parameters: vec![PactParameter {
          name: "id".to_string(),
          parameter_type: Some("string".to_string()),
        }],
        return_type: Some("object{user}".to_string()),
        body: "".to_string(),
        is_defun: true,
      }],
      capabilities: vec![],
      schemas: vec![],
      constants: vec![],
      uses: vec![],
      implements: vec![],
    };

    let files = plugin.generate_additional_files(&[module]).unwrap();
    assert_eq!(files.len(), 1);

    let hook_file = &files[0];
    assert_eq!(hook_file.path, "test.hooks.ts");
    assert!(hook_file.content.contains("useGetUser"));
    assert!(hook_file.content.contains("useQuery"));
  }

  #[test]
  fn test_mock_generator() {
    let plugin = MockGeneratorPlugin::new();

    let module = PactModule {
      name: "test".to_string(),
      namespace: None,
      governance: "".to_string(),
      doc: None,
      functions: vec![],
      capabilities: vec![],
      schemas: vec![crate::ast::PactSchema {
        name: "user".to_string(),
        doc: None,
        fields: vec![
          SchemaField {
            name: "name".to_string(),
            field_type: "string".to_string(),
          },
          SchemaField {
            name: "age".to_string(),
            field_type: "integer".to_string(),
          },
        ],
      }],
      constants: vec![],
      uses: vec![],
      implements: vec![],
    };

    let files = plugin.generate_additional_files(&[module]).unwrap();
    assert_eq!(files.len(), 2); // mocks and fixtures

    let mock_file = &files[0];
    assert_eq!(mock_file.path, "test.mocks.js");
    assert!(mock_file.content.contains("mockUser"));
    assert!(mock_file.content.contains("faker.person.fullName()"));
  }

  #[test]
  fn test_builtin_plugins() {
    let plugins = BuiltinPlugins::all();
    assert_eq!(plugins.len(), 3);

    let jsdoc = BuiltinPlugins::get("jsdoc-enhancer");
    assert!(jsdoc.is_some());

    let unknown = BuiltinPlugins::get("unknown-plugin");
    assert!(unknown.is_none());
  }
}
