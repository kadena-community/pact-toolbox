use napi_derive::napi;
use serde::{Deserialize, Serialize};

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactModule {
  pub name: String,
  pub namespace: Option<String>,
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
      namespace: None,
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

  pub fn with_namespace(name: String, namespace: Option<String>, governance: String) -> Self {
    Self {
      name,
      namespace,
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_pact_module_creation() {
    let module = PactModule::new("test".to_string(), "GOVERNANCE".to_string());

    assert_eq!(module.name, "test");
    assert_eq!(module.governance, "GOVERNANCE");
    assert_eq!(module.namespace, None);
    assert_eq!(module.doc, None);
    assert_eq!(module.functions.len(), 0);
    assert_eq!(module.capabilities.len(), 0);
    assert_eq!(module.schemas.len(), 0);
    assert_eq!(module.constants.len(), 0);
    assert_eq!(module.uses.len(), 0);
    assert_eq!(module.implements.len(), 0);
  }

  #[test]
  fn test_pact_module_with_namespace() {
    let module = PactModule::with_namespace(
      "todos".to_string(),
      Some("free".to_string()),
      "GOVERNANCE".to_string(),
    );

    assert_eq!(module.name, "todos");
    assert_eq!(module.namespace, Some("free".to_string()));
    assert_eq!(module.governance, "GOVERNANCE");
    assert_eq!(module.doc, None);
  }

  #[test]
  fn test_pact_module_with_no_namespace() {
    let module = PactModule::with_namespace("utils".to_string(), None, "GOVERNANCE".to_string());

    assert_eq!(module.name, "utils");
    assert_eq!(module.namespace, None);
    assert_eq!(module.governance, "GOVERNANCE");
  }

  #[test]
  fn test_add_function() {
    let mut module = PactModule::new("test".to_string(), "GOVERNANCE".to_string());

    let function = PactFunction {
      name: "test-func".to_string(),
      doc: Some("Test function".to_string()),
      parameters: vec![],
      return_type: Some("string".to_string()),
      body: "test".to_string(),
      is_defun: true,
    };

    module.add_function(function);

    assert_eq!(module.functions.len(), 1);
    assert_eq!(module.functions[0].name, "test-func");
    assert_eq!(module.functions[0].doc, Some("Test function".to_string()));
    assert_eq!(module.functions[0].return_type, Some("string".to_string()));
    assert!(module.functions[0].is_defun);
  }

  #[test]
  fn test_add_capability() {
    let mut module = PactModule::new("test".to_string(), "GOVERNANCE".to_string());

    let capability = PactCapability {
      name: "ADMIN".to_string(),
      doc: Some("Admin capability".to_string()),
      parameters: vec![],
      return_type: Some("bool".to_string()),
      managed: None,
      is_event: false,
    };

    module.add_capability(capability);

    assert_eq!(module.capabilities.len(), 1);
    assert_eq!(module.capabilities[0].name, "ADMIN");
    assert_eq!(
      module.capabilities[0].doc,
      Some("Admin capability".to_string())
    );
    assert_eq!(module.capabilities[0].return_type, Some("bool".to_string()));
    assert!(!module.capabilities[0].is_event);
  }

  #[test]
  fn test_add_schema() {
    let mut module = PactModule::new("test".to_string(), "GOVERNANCE".to_string());

    let schema = PactSchema {
      name: "user".to_string(),
      doc: Some("User schema".to_string()),
      fields: vec![
        SchemaField {
          name: "id".to_string(),
          field_type: "string".to_string(),
        },
        SchemaField {
          name: "name".to_string(),
          field_type: "string".to_string(),
        },
      ],
    };

    module.add_schema(schema);

    assert_eq!(module.schemas.len(), 1);
    assert_eq!(module.schemas[0].name, "user");
    assert_eq!(module.schemas[0].doc, Some("User schema".to_string()));
    assert_eq!(module.schemas[0].fields.len(), 2);
    assert_eq!(module.schemas[0].fields[0].name, "id");
    assert_eq!(module.schemas[0].fields[0].field_type, "string");
    assert_eq!(module.schemas[0].fields[1].name, "name");
    assert_eq!(module.schemas[0].fields[1].field_type, "string");
  }

  #[test]
  fn test_add_constant() {
    let mut module = PactModule::new("test".to_string(), "GOVERNANCE".to_string());

    let constant = PactConstant {
      name: "MAX_SUPPLY".to_string(),
      doc: Some("Maximum supply".to_string()),
      constant_type: Some("integer".to_string()),
      value: "1000000".to_string(),
    };

    module.add_constant(constant);

    assert_eq!(module.constants.len(), 1);
    assert_eq!(module.constants[0].name, "MAX_SUPPLY");
    assert_eq!(module.constants[0].doc, Some("Maximum supply".to_string()));
    assert_eq!(
      module.constants[0].constant_type,
      Some("integer".to_string())
    );
    assert_eq!(module.constants[0].value, "1000000");
  }

  #[test]
  fn test_add_use() {
    let mut module = PactModule::new("test".to_string(), "GOVERNANCE".to_string());

    module.add_use("coin".to_string());
    module.add_use("util.guards".to_string());

    assert_eq!(module.uses.len(), 2);
    assert_eq!(module.uses[0], "coin");
    assert_eq!(module.uses[1], "util.guards");
  }

  #[test]
  fn test_add_implements() {
    let mut module = PactModule::new("test".to_string(), "GOVERNANCE".to_string());

    module.add_implements("fungible-v2".to_string());
    module.add_implements("token-policy-v1".to_string());

    assert_eq!(module.implements.len(), 2);
    assert_eq!(module.implements[0], "fungible-v2");
    assert_eq!(module.implements[1], "token-policy-v1");
  }

  #[test]
  fn test_pact_function_creation() {
    let function = PactFunction {
      name: "transfer".to_string(),
      doc: Some("Transfer tokens".to_string()),
      parameters: vec![
        PactParameter {
          name: "from".to_string(),
          parameter_type: Some("string".to_string()),
        },
        PactParameter {
          name: "to".to_string(),
          parameter_type: Some("string".to_string()),
        },
        PactParameter {
          name: "amount".to_string(),
          parameter_type: Some("decimal".to_string()),
        },
      ],
      return_type: Some("string".to_string()),
      body: "(transfer-create from to amount)".to_string(),
      is_defun: true,
    };

    assert_eq!(function.name, "transfer");
    assert_eq!(function.doc, Some("Transfer tokens".to_string()));
    assert_eq!(function.parameters.len(), 3);
    assert_eq!(function.parameters[0].name, "from");
    assert_eq!(
      function.parameters[0].parameter_type,
      Some("string".to_string())
    );
    assert_eq!(function.parameters[1].name, "to");
    assert_eq!(
      function.parameters[1].parameter_type,
      Some("string".to_string())
    );
    assert_eq!(function.parameters[2].name, "amount");
    assert_eq!(
      function.parameters[2].parameter_type,
      Some("decimal".to_string())
    );
    assert_eq!(function.return_type, Some("string".to_string()));
    assert!(function.is_defun);
  }

  #[test]
  fn test_pact_capability_with_managed() {
    let capability = PactCapability {
      name: "TRANSFER".to_string(),
      doc: Some("Transfer capability".to_string()),
      parameters: vec![PactParameter {
        name: "from".to_string(),
        parameter_type: Some("string".to_string()),
      }],
      return_type: Some("bool".to_string()),
      managed: Some(ManagedInfo {
        parameter: "from".to_string(),
        manager_function: Some("transfer-mgr".to_string()),
      }),
      is_event: false,
    };

    assert_eq!(capability.name, "TRANSFER");
    assert_eq!(capability.doc, Some("Transfer capability".to_string()));
    assert_eq!(capability.parameters.len(), 1);
    assert_eq!(capability.return_type, Some("bool".to_string()));
    assert!(capability.managed.is_some());

    let managed = capability.managed.unwrap();
    assert_eq!(managed.parameter, "from");
    assert_eq!(managed.manager_function, Some("transfer-mgr".to_string()));
    assert!(!capability.is_event);
  }

  #[test]
  fn test_pact_capability_event() {
    let capability = PactCapability {
      name: "TRANSFER_EVENT".to_string(),
      doc: Some("Transfer event".to_string()),
      parameters: vec![],
      return_type: None,
      managed: None,
      is_event: true,
    };

    assert_eq!(capability.name, "TRANSFER_EVENT");
    assert_eq!(capability.doc, Some("Transfer event".to_string()));
    assert_eq!(capability.parameters.len(), 0);
    assert_eq!(capability.return_type, None);
    assert!(capability.managed.is_none());
    assert!(capability.is_event);
  }

  #[test]
  fn test_pact_parameter_without_type() {
    let parameter = PactParameter {
      name: "untyped".to_string(),
      parameter_type: None,
    };

    assert_eq!(parameter.name, "untyped");
    assert_eq!(parameter.parameter_type, None);
  }

  #[test]
  fn test_pact_parameter_with_type() {
    let parameter = PactParameter {
      name: "typed".to_string(),
      parameter_type: Some("string".to_string()),
    };

    assert_eq!(parameter.name, "typed");
    assert_eq!(parameter.parameter_type, Some("string".to_string()));
  }

  #[test]
  fn test_schema_field_creation() {
    let field = SchemaField {
      name: "user-id".to_string(),
      field_type: "string".to_string(),
    };

    assert_eq!(field.name, "user-id");
    assert_eq!(field.field_type, "string");
  }

  #[test]
  fn test_pact_constant_without_type() {
    let constant = PactConstant {
      name: "ADMIN_KEYSET".to_string(),
      doc: Some("Admin keyset".to_string()),
      constant_type: None,
      value: "\"admin-keyset\"".to_string(),
    };

    assert_eq!(constant.name, "ADMIN_KEYSET");
    assert_eq!(constant.doc, Some("Admin keyset".to_string()));
    assert_eq!(constant.constant_type, None);
    assert_eq!(constant.value, "\"admin-keyset\"");
  }

  #[test]
  fn test_pact_constant_with_type() {
    let constant = PactConstant {
      name: "MAX_SUPPLY".to_string(),
      doc: None,
      constant_type: Some("integer".to_string()),
      value: "1000000".to_string(),
    };

    assert_eq!(constant.name, "MAX_SUPPLY");
    assert_eq!(constant.doc, None);
    assert_eq!(constant.constant_type, Some("integer".to_string()));
    assert_eq!(constant.value, "1000000");
  }

  #[test]
  fn test_managed_info_without_manager() {
    let managed = ManagedInfo {
      parameter: "amount".to_string(),
      manager_function: None,
    };

    assert_eq!(managed.parameter, "amount");
    assert_eq!(managed.manager_function, None);
  }

  #[test]
  fn test_managed_info_with_manager() {
    let managed = ManagedInfo {
      parameter: "amount".to_string(),
      manager_function: Some("amount-mgr".to_string()),
    };

    assert_eq!(managed.parameter, "amount");
    assert_eq!(managed.manager_function, Some("amount-mgr".to_string()));
  }

  #[test]
  fn test_complex_module_setup() {
    let mut module = PactModule::with_namespace(
      "token".to_string(),
      Some("free".to_string()),
      "(keyset-ref-guard 'admin-keyset)".to_string(),
    );

    // Add uses
    module.add_use("coin".to_string());
    module.add_use("util.guards".to_string());

    // Add implements
    module.add_implements("fungible-v2".to_string());

    // Add schema
    let account_schema = PactSchema {
      name: "account".to_string(),
      doc: Some("Account schema".to_string()),
      fields: vec![
        SchemaField {
          name: "balance".to_string(),
          field_type: "decimal".to_string(),
        },
        SchemaField {
          name: "guard".to_string(),
          field_type: "guard".to_string(),
        },
      ],
    };
    module.add_schema(account_schema);

    // Add constant
    let decimals_constant = PactConstant {
      name: "DECIMALS".to_string(),
      doc: Some("Token decimals".to_string()),
      constant_type: Some("integer".to_string()),
      value: "12".to_string(),
    };
    module.add_constant(decimals_constant);

    // Add capability
    let transfer_cap = PactCapability {
      name: "TRANSFER".to_string(),
      doc: Some("Transfer capability".to_string()),
      parameters: vec![
        PactParameter {
          name: "from".to_string(),
          parameter_type: Some("string".to_string()),
        },
        PactParameter {
          name: "to".to_string(),
          parameter_type: Some("string".to_string()),
        },
        PactParameter {
          name: "amount".to_string(),
          parameter_type: Some("decimal".to_string()),
        },
      ],
      return_type: Some("bool".to_string()),
      managed: Some(ManagedInfo {
        parameter: "amount".to_string(),
        manager_function: Some("transfer-mgr".to_string()),
      }),
      is_event: false,
    };
    module.add_capability(transfer_cap);

    // Add function
    let transfer_function = PactFunction {
      name: "transfer".to_string(),
      doc: Some("Transfer tokens".to_string()),
      parameters: vec![
        PactParameter {
          name: "from".to_string(),
          parameter_type: Some("string".to_string()),
        },
        PactParameter {
          name: "to".to_string(),
          parameter_type: Some("string".to_string()),
        },
        PactParameter {
          name: "amount".to_string(),
          parameter_type: Some("decimal".to_string()),
        },
      ],
      return_type: Some("string".to_string()),
      body: "(transfer-create from to amount)".to_string(),
      is_defun: true,
    };
    module.add_function(transfer_function);

    // Verify everything was added correctly
    assert_eq!(module.name, "token");
    assert_eq!(module.namespace, Some("free".to_string()));
    assert_eq!(module.governance, "(keyset-ref-guard 'admin-keyset)");
    assert_eq!(module.uses.len(), 2);
    assert_eq!(module.implements.len(), 1);
    assert_eq!(module.schemas.len(), 1);
    assert_eq!(module.constants.len(), 1);
    assert_eq!(module.capabilities.len(), 1);
    assert_eq!(module.functions.len(), 1);

    // Verify specific details
    assert_eq!(module.uses[0], "coin");
    assert_eq!(module.uses[1], "util.guards");
    assert_eq!(module.implements[0], "fungible-v2");
    assert_eq!(module.schemas[0].name, "account");
    assert_eq!(module.schemas[0].fields.len(), 2);
    assert_eq!(module.constants[0].name, "DECIMALS");
    assert_eq!(module.capabilities[0].name, "TRANSFER");
    assert_eq!(module.functions[0].name, "transfer");
  }
}
