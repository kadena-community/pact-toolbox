use crate::optimized::arena::{Arena, OptString, OptVec, Symbol};
use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};

/// Optimized Pact module using arena allocation and string interning
pub struct OptPactModule<'arena> {
    pub name: Symbol,
    pub path: &'arena str,
    pub namespace: Option<Symbol>,
    pub governance: Option<Symbol>,
    pub doc: Option<&'arena str>,
    pub functions: OptVec<OptPactFunction<'arena>>,
    pub schemas: OptVec<OptPactSchema<'arena>>,
    pub capabilities: OptVec<OptPactCapability<'arena>>,
    pub arena: &'arena Arena,
}

/// Optimized Pact function with zero-copy string slices
pub struct OptPactFunction<'arena> {
    pub name: Symbol,
    pub path: &'arena str,
    pub doc: Option<&'arena str>,
    pub parameters: OptVec<OptPactParameter<'arena>>,
    pub return_type: Symbol,
    pub required_capabilities: OptVec<Symbol>,
    pub arena: &'arena Arena,
}

/// Optimized parameter with minimal allocation
pub struct OptPactParameter<'arena> {
    pub name: Symbol,
    pub param_type: Symbol,
    pub arena: &'arena Arena,
}

/// Optimized schema with arena allocation
pub struct OptPactSchema<'arena> {
    pub name: Symbol,
    pub doc: Option<&'arena str>,
    pub fields: OptVec<OptPactSchemaField<'arena>>,
    pub arena: &'arena Arena,
}

/// Optimized schema field
pub struct OptPactSchemaField<'arena> {
    pub name: Symbol,
    pub field_type: Symbol,
    pub arena: &'arena Arena,
}

/// Optimized capability
pub struct OptPactCapability<'arena> {
    pub name: Symbol,
    pub doc: Option<&'arena str>,
    pub parameters: OptVec<OptPactParameter<'arena>>,
    pub arena: &'arena Arena,
}

impl<'arena> OptPactModule<'arena> {
    pub fn new(name: &str, namespace: Option<&str>, arena: &'arena Arena) -> Self {
        let name_symbol = arena.intern_string(name);
        let namespace_symbol = namespace.map(|ns| arena.intern_string(ns));

        let path = if let Some(ns) = namespace {
            arena.alloc_str(&format!("{}.{}", ns, name))
        } else {
            arena.alloc_str(name)
        };

        Self {
            name: name_symbol,
            path,
            namespace: namespace_symbol,
            governance: None,
            doc: None,
            functions: OptVec::new(),
            schemas: OptVec::new(),
            capabilities: OptVec::new(),
            arena,
        }
    }

    /// Find schema by name (optimized lookup)
    #[inline]
    pub fn get_schema(&self, name: Symbol) -> Option<&OptPactSchema<'arena>> {
        self.schemas.iter().find(|s| s.name == name)
    }

    /// Find function by name (optimized lookup)
    #[inline]
    pub fn get_function(&self, name: Symbol) -> Option<&OptPactFunction<'arena>> {
        self.functions.iter().find(|f| f.name == name)
    }

    /// Convert to NAPI-compatible module
    pub fn to_napi_module(&self) -> PactModule {
        let name = self.arena.resolve_string(self.name).unwrap_or_default();
        let namespace = self.namespace
            .and_then(|ns| self.arena.resolve_string(ns));
        let governance = self.governance
            .and_then(|gov| self.arena.resolve_string(gov));

        PactModule {
            name,
            path: self.path.to_string(),
            namespace,
            governance,
            doc: self.doc.map(|s| s.to_string()),
            functions: self.functions.iter().map(|f| f.to_napi_function()).collect(),
            schemas: self.schemas.iter().map(|s| s.to_napi_schema()).collect(),
            capabilities: self.capabilities.iter().map(|c| c.to_napi_capability()).collect(),
        }
    }
}

impl<'arena> OptPactFunction<'arena> {
    pub fn new(name: &str, module_path: &'arena str, arena: &'arena Arena) -> Self {
        let name_symbol = arena.intern_string(name);
        let path = arena.alloc_str(&format!("{}.{}", module_path, name));

        Self {
            name: name_symbol,
            path,
            doc: None,
            parameters: OptVec::new(),
            return_type: arena.intern_string("void"),
            required_capabilities: OptVec::new(),
            arena,
        }
    }

    pub fn to_napi_function(&self) -> PactFunction {
        let name = self.arena.resolve_string(self.name).unwrap_or_default();
        let return_type = self.arena.resolve_string(self.return_type).unwrap_or_default();

        PactFunction {
            name,
            path: self.path.to_string(),
            doc: self.doc.map(|s| s.to_string()),
            parameters: self.parameters.iter().map(|p| p.to_napi_parameter()).collect(),
            return_type,
            required_capabilities: self.required_capabilities
                .iter()
                .filter_map(|&cap| self.arena.resolve_string(cap))
                .map(|s| s.to_string())
                .collect(),
        }
    }
}

impl<'arena> OptPactParameter<'arena> {
    pub fn new(name: &str, param_type: &str, arena: &'arena Arena) -> Self {
        Self {
            name: arena.intern_string(name),
            param_type: arena.intern_string(param_type),
            arena,
        }
    }

    pub fn to_napi_parameter(&self) -> PactParameter {
        PactParameter {
            name: self.arena.resolve_string(self.name).unwrap_or_default(),
            param_type: self.arena.resolve_string(self.param_type).unwrap_or_else(|| "unknown".to_string()),
        }
    }
}

impl<'arena> OptPactSchema<'arena> {
    pub fn new(name: &str, arena: &'arena Arena) -> Self {
        Self {
            name: arena.intern_string(name),
            doc: None,
            fields: OptVec::new(),
            arena,
        }
    }

    pub fn to_napi_schema(&self) -> PactSchema {
        PactSchema {
            name: self.arena.resolve_string(self.name).unwrap_or_default(),
            doc: self.doc.map(|s| s.to_string()),
            fields: self.fields.iter().map(|f| f.to_napi_field()).collect(),
        }
    }
}

impl<'arena> OptPactSchemaField<'arena> {
    pub fn new(name: &str, field_type: &str, arena: &'arena Arena) -> Self {
        Self {
            name: arena.intern_string(name),
            field_type: arena.intern_string(field_type),
            arena,
        }
    }

    pub fn to_napi_field(&self) -> PactSchemaField {
        PactSchemaField {
            name: self.arena.resolve_string(self.name).unwrap_or_default(),
            field_type: self.arena.resolve_string(self.field_type).unwrap_or_else(|| "unknown".to_string()),
        }
    }
}

impl<'arena> OptPactCapability<'arena> {
    pub fn new(name: &str, arena: &'arena Arena) -> Self {
        Self {
            name: arena.intern_string(name),
            doc: None,
            parameters: OptVec::new(),
            arena,
        }
    }

    pub fn to_napi_capability(&self) -> PactCapability {
        PactCapability {
            name: self.arena.resolve_string(self.name).unwrap_or_default(),
            doc: self.doc.map(|s| s.to_string()),
            parameters: self.parameters.iter().map(|p| p.to_napi_parameter()).collect(),
        }
    }
}

// Original NAPI types for compatibility
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

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactParameter {
    pub name: String,
    pub param_type: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactSchema {
    pub name: String,
    pub doc: Option<String>,
    pub fields: Vec<PactSchemaField>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactSchemaField {
    pub name: String,
    pub field_type: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactCapability {
    pub name: String,
    pub doc: Option<String>,
    pub parameters: Vec<PactParameter>,
}
