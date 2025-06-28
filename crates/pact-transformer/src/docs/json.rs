use super::{utils, DocsGenerator, DocsOptions, Documentation};
use crate::ast::{PactCapability, PactConstant, PactFunction, PactModule, PactSchema};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// JSON documentation generator
pub struct JsonGenerator;

impl JsonGenerator {
  pub fn new() -> Self {
    Self
  }
}

impl DocsGenerator for JsonGenerator {
  fn name(&self) -> &'static str {
    "json"
  }

  fn generate(&self, modules: &[PactModule], options: &DocsOptions) -> Result<Documentation> {
    let content = self.generate_index(modules, options)?;
    let metadata = utils::generate_metadata(modules, self.name());

    Ok(Documentation {
      content,
      assets: HashMap::new(),
      toc: None,
      search_index: None,
      metadata,
    })
  }

  fn generate_index(&self, modules: &[PactModule], _options: &DocsOptions) -> Result<String> {
    let api_doc = ApiDocumentation {
      version: "1.0".to_string(),
      generated_at: chrono::Utc::now().to_rfc3339(),
      modules: modules.iter().map(|m| self.module_to_json(m)).collect(),
    };

    Ok(serde_json::to_string_pretty(&api_doc)?)
  }

  fn generate_module(&self, module: &PactModule, _options: &DocsOptions) -> Result<String> {
    Ok(serde_json::to_string_pretty(&self.module_to_json(module))?)
  }

  fn generate_function(
    &self,
    function: &PactFunction,
    module: &PactModule,
    _options: &DocsOptions,
  ) -> Result<String> {
    Ok(serde_json::to_string_pretty(
      &self.function_to_json(function, module),
    )?)
  }

  fn generate_capability(
    &self,
    capability: &PactCapability,
    module: &PactModule,
    _options: &DocsOptions,
  ) -> Result<String> {
    Ok(serde_json::to_string_pretty(
      &self.capability_to_json(capability, module),
    )?)
  }

  fn generate_schema(
    &self,
    schema: &PactSchema,
    module: &PactModule,
    _options: &DocsOptions,
  ) -> Result<String> {
    Ok(serde_json::to_string_pretty(
      &self.schema_to_json(schema, module),
    )?)
  }

  fn generate_constant(
    &self,
    constant: &PactConstant,
    module: &PactModule,
    _options: &DocsOptions,
  ) -> Result<String> {
    Ok(serde_json::to_string_pretty(
      &self.constant_to_json(constant, module),
    )?)
  }
}

impl JsonGenerator {
  fn module_to_json(&self, module: &PactModule) -> ModuleDoc {
    ModuleDoc {
      name: module.name.clone(),
      namespace: module.namespace.clone(),
      governance: module.governance.clone(),
      description: module.doc.as_ref().map(|d| utils::clean_doc(d)),
      uses: module.uses.clone(),
      implements: module.implements.clone(),
      functions: module
        .functions
        .iter()
        .map(|f| self.function_to_json(f, module))
        .collect(),
      capabilities: module
        .capabilities
        .iter()
        .map(|c| self.capability_to_json(c, module))
        .collect(),
      schemas: module
        .schemas
        .iter()
        .map(|s| self.schema_to_json(s, module))
        .collect(),
      constants: module
        .constants
        .iter()
        .map(|c| self.constant_to_json(c, module))
        .collect(),
    }
  }

  fn function_to_json(&self, function: &PactFunction, module: &PactModule) -> FunctionDoc {
    let (description, tags) = if let Some(doc) = &function.doc {
      let desc = utils::clean_doc(doc);
      let mut tags = HashMap::new();

      // Extract all tags
      for line in doc.lines() {
        if let Some(tag_line) = line.trim().strip_prefix("@") {
          if let Some((tag, value)) = tag_line.split_once(' ') {
            tags
              .entry(tag.to_string())
              .or_insert_with(Vec::new)
              .push(value.to_string());
          }
        }
      }

      (Some(desc), tags)
    } else {
      (None, HashMap::new())
    };

    FunctionDoc {
      name: function.name.clone(),
      module: module.name.clone(),
      signature: utils::generate_signature(function),
      description,
      parameters: function
        .parameters
        .iter()
        .map(|p| {
          let param_desc = tags.get("param").and_then(|params| {
            params
              .iter()
              .find(|pd| pd.starts_with(&p.name))
              .and_then(|pd| pd.strip_prefix(&format!("{} ", p.name)))
              .map(|s| s.to_string())
          });

          ParameterDoc {
            name: p.name.clone(),
            type_info: p
              .parameter_type
              .clone()
              .unwrap_or_else(|| "any".to_string()),
            description: param_desc,
            optional: false,
          }
        })
        .collect(),
      return_type: function.return_type.as_ref().map(|rt| ReturnDoc {
        type_info: rt.clone(),
        description: tags
          .get("return")
          .and_then(|returns| returns.first().cloned()),
      }),
      examples: utils::extract_examples(function.doc.as_deref().unwrap_or("")),
      tags,
      is_defun: function.is_defun,
    }
  }

  fn capability_to_json(&self, capability: &PactCapability, module: &PactModule) -> CapabilityDoc {
    CapabilityDoc {
      name: capability.name.clone(),
      module: module.name.clone(),
      description: capability.doc.as_ref().map(|d| utils::clean_doc(d)),
      parameters: capability
        .parameters
        .iter()
        .map(|p| ParameterDoc {
          name: p.name.clone(),
          type_info: p
            .parameter_type
            .clone()
            .unwrap_or_else(|| "any".to_string()),
          description: None,
          optional: false,
        })
        .collect(),
      managed: capability.managed.as_ref().map(|m| ManagedDoc {
        parameter: m.parameter.clone(),
        manager_function: m.manager_function.clone(),
      }),
      is_event: capability.is_event,
    }
  }

  fn schema_to_json(&self, schema: &PactSchema, module: &PactModule) -> SchemaDoc {
    SchemaDoc {
      name: schema.name.clone(),
      module: module.name.clone(),
      description: schema.doc.as_ref().map(|d| utils::clean_doc(d)),
      fields: schema
        .fields
        .iter()
        .map(|f| FieldDoc {
          name: f.name.clone(),
          type_info: f.field_type.clone(),
          description: None,
          required: true,
        })
        .collect(),
    }
  }

  fn constant_to_json(&self, constant: &PactConstant, module: &PactModule) -> ConstantDoc {
    ConstantDoc {
      name: constant.name.clone(),
      module: module.name.clone(),
      description: constant.doc.as_ref().map(|d| utils::clean_doc(d)),
      type_info: constant.constant_type.clone(),
      value: constant.value.clone(),
    }
  }
}

// JSON documentation structures

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ApiDocumentation {
  version: String,
  generated_at: String,
  modules: Vec<ModuleDoc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ModuleDoc {
  name: String,
  namespace: Option<String>,
  governance: String,
  description: Option<String>,
  uses: Vec<String>,
  implements: Vec<String>,
  functions: Vec<FunctionDoc>,
  capabilities: Vec<CapabilityDoc>,
  schemas: Vec<SchemaDoc>,
  constants: Vec<ConstantDoc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FunctionDoc {
  name: String,
  module: String,
  signature: String,
  description: Option<String>,
  parameters: Vec<ParameterDoc>,
  return_type: Option<ReturnDoc>,
  examples: Vec<String>,
  tags: HashMap<String, Vec<String>>,
  is_defun: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ParameterDoc {
  name: String,
  type_info: String,
  description: Option<String>,
  optional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReturnDoc {
  type_info: String,
  description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CapabilityDoc {
  name: String,
  module: String,
  description: Option<String>,
  parameters: Vec<ParameterDoc>,
  managed: Option<ManagedDoc>,
  is_event: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ManagedDoc {
  parameter: String,
  manager_function: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SchemaDoc {
  name: String,
  module: String,
  description: Option<String>,
  fields: Vec<FieldDoc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FieldDoc {
  name: String,
  type_info: String,
  description: Option<String>,
  required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConstantDoc {
  name: String,
  module: String,
  description: Option<String>,
  type_info: Option<String>,
  value: String,
}

impl Default for JsonGenerator {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::ast::{PactFunction, PactParameter};

  #[test]
  fn test_json_generator() {
    let generator = JsonGenerator::new();
    assert_eq!(generator.name(), "json");
  }

  #[test]
  fn test_json_output() {
    let module = PactModule {
      name: "test-module".to_string(),
      namespace: Some("test.namespace".to_string()),
      doc: Some("Test module documentation".to_string()),
      governance: "GOVERNANCE".to_string(),
      functions: vec![PactFunction {
        name: "test-function".to_string(),
        doc: Some("Test function\n@param value Input value\n@return Result string".to_string()),
        parameters: vec![PactParameter {
          name: "value".to_string(),
          parameter_type: Some("integer".to_string()),
        }],
        return_type: Some("string".to_string()),
        body: String::new(),
        is_defun: true,
      }],
      capabilities: Vec::new(),
      schemas: Vec::new(),
      constants: Vec::new(),
      uses: Vec::new(),
      implements: Vec::new(),
    };

    let generator = JsonGenerator::new();
    let options = DocsOptions::default();
    let json = generator.generate_module(&module, &options).unwrap();

    assert!(json.contains("\"name\": \"test-module\""));
    assert!(json.contains("\"namespace\": \"test.namespace\""));
    assert!(json.contains("\"name\": \"test-function\""));
    assert!(json.contains("\"signature\": \"test-function(value:integer):string\""));
  }
}
