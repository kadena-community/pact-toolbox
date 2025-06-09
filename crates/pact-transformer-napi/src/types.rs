use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};

/// Represents a Pact module
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactModule {
    pub name: String,
    pub path: String,
    pub namespace: Option<String>,
    pub governance: Option<String>,
    pub doc: Option<String>,
    pub functions: Vec<PactFunction>,
    pub schemas: Vec<PactSchema>,
    pub capabilities: Vec<PactCapability>,
}

/// Represents a Pact function
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactFunction {
    pub name: String,
    pub path: String,
    pub doc: Option<String>,
    pub parameters: Vec<PactParameter>,
    pub return_type: String,
    pub required_capabilities: Vec<String>,
}

/// Represents a function parameter
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactParameter {
    pub name: String,
    pub param_type: String,
}

/// Represents a Pact schema
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactSchema {
    pub name: String,
    pub doc: Option<String>,
    pub fields: Vec<PactSchemaField>,
}

/// Represents a schema field
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactSchemaField {
    pub name: String,
    pub field_type: String,
}

/// Represents a Pact capability
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactCapability {
    pub name: String,
    pub doc: Option<String>,
    pub parameters: Vec<PactParameter>,
}

impl PactModule {
    pub fn new(name: String, namespace: Option<String>) -> Self {
        let path = if let Some(ns) = &namespace {
            format!("{}.{}", ns, name)
        } else {
            name.clone()
        };

        Self {
            name,
            path,
            namespace,
            governance: None,
            doc: None,
            functions: Vec::new(),
            schemas: Vec::new(),
            capabilities: Vec::new(),
        }
    }

    pub fn get_schema(&self, name: &str) -> Option<&PactSchema> {
        self.schemas.iter().find(|s| s.name.to_lowercase() == name.to_lowercase())
    }

    pub fn get_function(&self, name: &str) -> Option<&PactFunction> {
        self.functions.iter().find(|f| f.name == name)
    }

    pub fn get_capability(&self, name: &str) -> Option<&PactCapability> {
        self.capabilities.iter().find(|c| c.name == name)
    }
}

impl PactFunction {
    pub fn new(name: String, module_path: &str) -> Self {
        Self {
            name: name.clone(),
            path: format!("{}.{}", module_path, name),
            doc: None,
            parameters: Vec::new(),
            return_type: "void".to_string(),
            required_capabilities: Vec::new(),
        }
    }
}

impl PactSchema {
    pub fn new(name: String) -> Self {
        Self {
            name,
            doc: None,
            fields: Vec::new(),
        }
    }
}

impl PactCapability {
    pub fn new(name: String) -> Self {
        Self {
            name,
            doc: None,
            parameters: Vec::new(),
        }
    }
}
