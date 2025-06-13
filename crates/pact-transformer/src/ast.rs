use napi_derive::napi;
use serde::{Deserialize, Serialize};

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactModule {
    pub name: String,
    pub doc: Option<String>,
    pub governance: String,
    pub functions: Vec<PactFunction>,
    pub capabilities: Vec<PactCapability>,
    pub schemas: Vec<PactSchema>,
    pub constants: Vec<PactConstant>,
    pub uses: Vec<String>,
    pub implements: Vec<String>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactFunction {
    pub name: String,
    pub doc: Option<String>,
    pub parameters: Vec<PactParameter>,
    pub return_type: Option<String>,
    pub body: String,
    pub is_defun: bool,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactCapability {
    pub name: String,
    pub doc: Option<String>,
    pub parameters: Vec<PactParameter>,
    pub return_type: Option<String>,
    pub managed: Option<ManagedInfo>,
    pub is_event: bool,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagedInfo {
    pub parameter: String,
    pub manager_function: Option<String>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactSchema {
    pub name: String,
    pub doc: Option<String>,
    pub fields: Vec<SchemaField>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaField {
    pub name: String,
    pub field_type: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactConstant {
    pub name: String,
    pub doc: Option<String>,
    pub constant_type: Option<String>,
    pub value: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactParameter {
    pub name: String,
    pub parameter_type: Option<String>,
}

impl PactModule {
    pub fn new(name: String, governance: String) -> Self {
        Self {
            name,
            doc: None,
            governance,
            functions: Vec::new(),
            capabilities: Vec::new(),
            schemas: Vec::new(),
            constants: Vec::new(),
            uses: Vec::new(),
            implements: Vec::new(),
        }
    }

    pub fn add_function(&mut self, function: PactFunction) {
        self.functions.push(function);
    }

    pub fn add_capability(&mut self, capability: PactCapability) {
        self.capabilities.push(capability);
    }

    pub fn add_schema(&mut self, schema: PactSchema) {
        self.schemas.push(schema);
    }

    pub fn add_constant(&mut self, constant: PactConstant) {
        self.constants.push(constant);
    }

    pub fn add_use(&mut self, module: String) {
        self.uses.push(module);
    }

    pub fn add_implements(&mut self, interface: String) {
        self.implements.push(interface);
    }
}
