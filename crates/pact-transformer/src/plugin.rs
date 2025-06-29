use crate::ast::{PactFunction, PactModule};
use anyhow::Result;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::Write;
use std::sync::{Arc, Mutex};

/// Plugin trait for extending the transformer
pub trait TransformPlugin: Send + Sync {
  /// Get the plugin name
  fn name(&self) -> &str;

  /// Get plugin description
  fn description(&self) -> &'static str {
    "No description provided"
  }

  /// Initialize the plugin with options
  #[allow(dead_code)]
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
  #[allow(dead_code)]
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
}

impl Default for PluginManager {
  fn default() -> Self {
    Self::new()
  }
}

/// Built-in plugin: `JSDoc` Enhancer
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
  fn name(&self) -> &'static str {
    "jsdoc-enhancer"
  }

  fn description(&self) -> &'static str {
    "Enhances JSDoc comments with examples and detailed parameter descriptions"
  }

  fn initialize(&mut self, options: &HashMap<String, serde_json::Value>) -> Result<()> {
    if let Some(add_examples) = options
      .get("addExamples")
      .and_then(serde_json::Value::as_bool)
    {
      self.add_examples = add_examples;
    }
    if let Some(add_params) = options
      .get("addParamDescriptions")
      .and_then(serde_json::Value::as_bool)
    {
      self.add_param_descriptions = add_params;
    }
    if let Some(add_returns) = options
      .get("addReturnsDescription")
      .and_then(serde_json::Value::as_bool)
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
          write!(
            enhanced_doc,
            "\n * @param {{{}}} {} - The {} parameter",
            param.parameter_type.as_deref().unwrap_or("any"),
            param.name,
            param.name
          )
          .unwrap();
        }
      }

      // Add returns description
      if self.add_returns_description {
        if let Some(return_type) = &function.return_type {
          write!(
            enhanced_doc,
            "\n * @returns {{{}}} The result of the {} operation",
            return_type, function.name
          )
          .unwrap();
        }
      }

      // Add example
      if self.add_examples {
        enhanced_doc.push_str("\n * @example");
        write!(
          enhanced_doc,
          "\n * // Using {} from {}",
          function.name, module_name
        )
        .unwrap();

        let params = function
          .parameters
          .iter()
          .map(|p| format!("'{}'", p.name))
          .collect::<Vec<_>>()
          .join(", ");

        write!(
          enhanced_doc,
          "\n * const result = await {}({});",
          function.name, params
        )
        .unwrap();
      }

      *doc = enhanced_doc;
    }
    Ok(())
  }
}

/// Plugin registry for built-in plugins
pub struct BuiltinPlugins;

impl BuiltinPlugins {
  /// Get a built-in plugin by name
  pub fn get(name: &str) -> Option<Box<dyn TransformPlugin>> {
    match name {
      "jsdoc-enhancer" => Some(Box::new(JSDocEnhancerPlugin::new())),
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
#[allow(clippy::needless_pass_by_value)]
pub fn register_builtin_plugin(name: String) -> Result<bool, napi::Error> {
  if let Some(plugin) = BuiltinPlugins::get(&name) {
    let manager = get_plugin_manager();
    let mut manager_lock = manager.lock().unwrap();
    manager_lock.register(plugin);
    Ok(true)
  } else {
    Err(napi::Error::from_reason(format!(
      "Unknown built-in plugin: {name}"
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
#[allow(clippy::needless_pass_by_value)]
pub fn set_plugin_enabled(name: String, enabled: bool) {
  let manager = get_plugin_manager();
  let mut manager_lock = manager.lock().unwrap();
  manager_lock.set_enabled(&name, enabled);
}

/// Initialize plugins with options
#[napi]
#[allow(dead_code)]
#[allow(clippy::needless_pass_by_value)]
pub fn initialize_plugins(
  options: HashMap<String, HashMap<String, serde_json::Value>>,
) -> Result<(), napi::Error> {
  let manager = get_plugin_manager();
  let mut manager_lock = manager.lock().unwrap();
  manager_lock
    .initialize_all(&options)
    .map_err(|e| napi::Error::from_reason(e.to_string()))
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::ast::PactParameter;

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
      body: String::new(),
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
  fn test_builtin_plugins() {
    let jsdoc = BuiltinPlugins::get("jsdoc-enhancer");
    assert!(jsdoc.is_some());

    let unknown = BuiltinPlugins::get("unknown-plugin");
    assert!(unknown.is_none());
  }
}
