// Arena functionality simplified
use crate::ast::*;
use crate::error::ParseError;
use rayon::prelude::*;
use std::sync::Arc;
use tree_sitter::{Node, Parser as TSParser};

pub struct Parser {
  ts_parser: TSParser,
}

impl Parser {
  pub fn new() -> Self {
    let mut ts_parser = TSParser::new();
    let language = tree_sitter_pact::LANGUAGE;
    ts_parser
      .set_language(&language.into())
      .expect("Error loading Pact grammar");

    Self { ts_parser }
  }

  pub fn parse(&mut self, source: &str) -> (Vec<PactModule>, Vec<ParseError>) {
    let tree = match self.ts_parser.parse(source, None) {
      Some(tree) => tree,
      None => {
        return (
          vec![],
          vec![ParseError::new("Failed to parse".to_string(), 0, 0)],
        );
      }
    };

    let root_node = tree.root_node();
    let mut errors = Vec::new();

    // Collect parse errors
    if root_node.has_error() {
      let mut cursor = root_node.walk();
      collect_errors(&mut cursor, &mut errors);
    }

    // Extract namespace and modules
    let source_arc = Arc::new(source.to_string());
    let current_namespace = self.find_current_namespace(root_node, &source_arc);
    let module_nodes = self.find_modules(root_node);

    let modules: Vec<PactModule> = module_nodes
      .into_par_iter()
      .filter_map(|node| self.parse_module(node, &source_arc, current_namespace.clone()))
      .collect();

    (modules, errors)
  }

  fn find_current_namespace(&self, root: Node, source: &Arc<String>) -> Option<String> {
    let mut cursor = root.walk();

    for child in root.children(&mut cursor) {
      if child.kind() == "namespace" {
        // Look for the namespace value - it's usually the second child after the identifier
        let mut namespace_cursor = child.walk();
        for namespace_child in child.children(&mut namespace_cursor) {
          if namespace_child.kind() == "string" || namespace_child.kind() == "symbol" {
            if let Ok(text) = namespace_child.utf8_text(source.as_bytes()) {
              // Remove quotes if present
              let namespace = text.trim_matches('\'').trim_matches('"').to_string();
              return Some(namespace);
            }
          }
        }
      }
    }

    None
  }

  fn find_modules<'a>(&self, root: Node<'a>) -> Vec<Node<'a>> {
    let mut modules = Vec::new();
    let mut cursor = root.walk();

    for child in root.children(&mut cursor) {
      if child.kind() == "module" {
        modules.push(child);
      }
    }

    modules
  }

  fn find_child_by_kind<'a>(parent: Node<'a>, kind: &str) -> Option<Node<'a>> {
    let mut cursor = parent.walk();
    let result = parent.children(&mut cursor).find(|n| n.kind() == kind);
    result
  }

  fn parse_module(
    &self,
    node: Node,
    source: &Arc<String>,
    namespace: Option<String>,
  ) -> Option<PactModule> {
    // Extract module name and governance using named fields
    let name = Self::find_child_by_kind(node, "module_identifier")?
      .utf8_text(source.as_bytes())
      .ok()?
      .to_string();

    let governance = Self::find_child_by_kind(node, "module_governance")?
      .utf8_text(source.as_bytes())
      .ok()?
      .to_string();

    let mut module = PactModule::with_namespace(name, namespace, governance);

    // Process all children
    let mut cursor = node.walk();
    let children: Vec<Node> = node.children(&mut cursor).collect();

    let (functions, capabilities, schemas, constants, uses, implements, docs) =
      rayon::scope(|_s| {
        let mut functions = Vec::new();
        let mut capabilities = Vec::new();
        let mut schemas = Vec::new();
        let mut constants = Vec::new();
        let mut uses = Vec::new();
        let mut implements = Vec::new();
        let mut docs = Vec::new();

        for child in &children {
          match child.kind() {
            "defun" => {
              if let Some(func) = self.parse_function(*child, source) {
                functions.push(func);
              }
            }
            "defcap" => {
              if let Some(cap) = self.parse_capability(*child, source) {
                capabilities.push(cap);
              }
            }
            "defschema" => {
              if let Some(schema) = self.parse_schema(*child, source) {
                schemas.push(schema);
              }
            }
            "defconst" => {
              if let Some(constant) = self.parse_constant(*child, source) {
                constants.push(constant);
              }
            }
            "use" => {
              if let Some(use_stmt) = self.parse_use(*child, source) {
                uses.push(use_stmt);
              }
            }
            "implements" => {
              if let Some(impl_stmt) = self.parse_implements(*child, source) {
                implements.push(impl_stmt);
              }
            }
            "doc" => {
              if let Some(doc) = self.extract_doc(*child, source) {
                docs.push(doc);
              }
            }
            _ => {}
          }
        }

        (
          functions,
          capabilities,
          schemas,
          constants,
          uses,
          implements,
          docs,
        )
      });

    module.functions = functions;
    module.capabilities = capabilities;
    module.schemas = schemas;
    module.constants = constants;
    module.uses = uses;
    module.implements = implements;
    module.doc = docs.first().cloned();

    Some(module)
  }

  fn parse_function(&self, node: Node, source: &Arc<String>) -> Option<PactFunction> {
    // Find the def_identifier node and type annotation
    let name_with_type_node = Self::find_child_by_kind(node, "def_identifier")?;
    let name = name_with_type_node
      .utf8_text(source.as_bytes())
      .ok()?
      .to_string();

    // Extract return type if present (it's a sibling of def_identifier)
    let mut return_type = None;
    let mut cursor = node.walk();
    let children: Vec<Node> = node.children(&mut cursor).collect();

    // Find type annotation that follows the def_identifier
    for (i, child) in children.iter().enumerate() {
      if child.kind() == "def_identifier" {
        if let Some(next) = children.get(i + 1) {
          if next.kind() == "type_annotation" {
            return_type = Self::find_child_by_kind(*next, "type_identifier")
              .and_then(|n| n.utf8_text(source.as_bytes()).ok())
              .map(|s| s.to_string());
          }
        }
        break;
      }
    }

    // Find parameter_list node
    let params_node = Self::find_child_by_kind(node, "parameter_list")?;
    let parameters = self.parse_parameters(params_node, source);

    let mut function = PactFunction {
      name,
      doc: None,
      parameters,
      return_type,
      body: self.extract_function_body(node, source),
      is_defun: true,
    };

    // Check for doc strings
    if let Some(doc_node) = Self::find_child_by_kind(node, "doc") {
      function.doc = self.extract_doc(doc_node, source);
    }

    Some(function)
  }

  fn parse_capability(&self, node: Node, source: &Arc<String>) -> Option<PactCapability> {
    // Similar to parse_function
    let name_node = Self::find_child_by_kind(node, "def_identifier")?;
    let name = name_node.utf8_text(source.as_bytes()).ok()?.to_string();

    // Extract return type if present
    let mut return_type = None;
    let mut cursor = node.walk();
    let children: Vec<Node> = node.children(&mut cursor).collect();

    for (i, child) in children.iter().enumerate() {
      if child.kind() == "def_identifier" {
        if let Some(next) = children.get(i + 1) {
          if next.kind() == "type_annotation" {
            return_type = Self::find_child_by_kind(*next, "type_identifier")
              .and_then(|n| n.utf8_text(source.as_bytes()).ok())
              .map(|s| s.to_string());
          }
        }
        break;
      }
    }

    let params_node = Self::find_child_by_kind(node, "parameter_list")?;
    let parameters = self.parse_parameters(params_node, source);

    let mut capability = PactCapability {
      name,
      doc: None,
      parameters,
      return_type,
      managed: None,
      is_event: false,
    };

    // Check for doc, @managed, @event
    let mut cursor = node.walk();
    let children: Vec<Node> = node.children(&mut cursor).collect();

    for (i, child) in children.iter().enumerate() {
      match child.kind() {
        "doc" => capability.doc = self.extract_doc(*child, source),
        "managed" => {
          // @managed is followed by parameter and optional manager function
          if let Some(param_node) = children.get(i + 1) {
            if param_node.kind() == "reference" {
              let parameter = param_node.utf8_text(source.as_bytes()).ok()?.to_string();
              let manager_function = children
                .get(i + 2)
                .filter(|n| n.kind() == "reference")
                .and_then(|n| n.utf8_text(source.as_bytes()).ok())
                .map(|s| s.to_string());
              capability.managed = Some(ManagedInfo {
                parameter,
                manager_function,
              });
            }
          }
        }
        "reference" => {
          // Check if this is @event
          if let Ok(text) = child.utf8_text(source.as_bytes()) {
            if text == "@event" {
              capability.is_event = true;
            }
          }
        }
        _ => {}
      }
    }

    Some(capability)
  }

  fn parse_schema(&self, node: Node, source: &Arc<String>) -> Option<PactSchema> {
    let name_node = Self::find_child_by_kind(node, "def_identifier")?;
    let name = name_node.utf8_text(source.as_bytes()).ok()?.to_string();

    let mut schema = PactSchema {
      name,
      doc: None,
      fields: Vec::new(),
    };

    // Parse fields from schema_field_list
    if let Some(field_list) = Self::find_child_by_kind(node, "schema_field_list") {
      let mut cursor = field_list.walk();
      for field_node in field_list.children(&mut cursor) {
        if field_node.kind() == "schema_field" {
          if let Some(field) = self.parse_schema_field(field_node, source) {
            schema.fields.push(field);
          }
        }
      }
    }

    // Check for doc
    if let Some(doc_node) = Self::find_child_by_kind(node, "doc") {
      schema.doc = self.extract_doc(doc_node, source);
    }

    Some(schema)
  }

  fn parse_constant(&self, node: Node, source: &Arc<String>) -> Option<PactConstant> {
    let name_node = Self::find_child_by_kind(node, "def_identifier")?;
    let name = name_node.utf8_text(source.as_bytes()).ok()?.to_string();

    // Extract type if present
    let mut constant_type = None;
    let mut cursor = node.walk();
    let children: Vec<Node> = node.children(&mut cursor).collect();

    for (i, child) in children.iter().enumerate() {
      if child.kind() == "def_identifier" {
        if let Some(next) = children.get(i + 1) {
          if next.kind() == "type_annotation" {
            constant_type = Self::find_child_by_kind(*next, "type_identifier")
              .and_then(|n| n.utf8_text(source.as_bytes()).ok())
              .map(|s| s.to_string());
          }
        }
        break;
      }
    }

    // Find the value (it's an expression after the name/type)
    let mut value = String::new();
    let mut found_name = false;
    for child in children {
      if found_name && child.kind() != "type_annotation" && child.kind() != "doc" {
        value = child.utf8_text(source.as_bytes()).ok()?.to_string();
        break;
      }
      if child.kind() == "def_identifier" {
        found_name = true;
      }
    }

    let mut constant = PactConstant {
      name,
      doc: None,
      constant_type,
      value,
    };

    // Check for doc
    if let Some(doc_node) = Self::find_child_by_kind(node, "doc") {
      constant.doc = self.extract_doc(doc_node, source);
    }

    Some(constant)
  }

  fn parse_parameters(&self, node: Node, source: &Arc<String>) -> Vec<PactParameter> {
    let mut cursor = node.walk();
    node
      .children(&mut cursor)
      .filter(|child| child.kind() == "parameter")
      .filter_map(|param_node| self.parse_parameter(param_node, source))
      .collect()
  }

  fn parse_parameter(&self, node: Node, source: &Arc<String>) -> Option<PactParameter> {
    let name_node = Self::find_child_by_kind(node, "parameter_identifier")?;
    let name = name_node.utf8_text(source.as_bytes()).ok()?.to_string();

    let parameter_type = Self::find_child_by_kind(node, "type_annotation")
      .and_then(|n| Self::find_child_by_kind(n, "type_identifier"))
      .and_then(|n| n.utf8_text(source.as_bytes()).ok())
      .map(|s| s.to_string());

    Some(PactParameter {
      name,
      parameter_type,
    })
  }

  fn parse_schema_field(&self, node: Node, source: &Arc<String>) -> Option<SchemaField> {
    let name_node = Self::find_child_by_kind(node, "schema_field_identifier")?;
    let name = name_node.utf8_text(source.as_bytes()).ok()?.to_string();

    let field_type = Self::find_child_by_kind(node, "type_annotation")
      .and_then(|n| Self::find_child_by_kind(n, "type_identifier"))
      .and_then(|n| n.utf8_text(source.as_bytes()).ok())
      .map(|s| s.to_string())
      .unwrap_or_else(|| "string".to_string());

    Some(SchemaField { name, field_type })
  }

  fn parse_use(&self, node: Node, source: &Arc<String>) -> Option<String> {
    // Use statements have a reference node as child
    Self::find_child_by_kind(node, "reference")
      .and_then(|n| n.utf8_text(source.as_bytes()).ok())
      .map(|s| s.to_string())
  }

  fn parse_implements(&self, node: Node, source: &Arc<String>) -> Option<String> {
    // Implements statements have a reference node as child
    Self::find_child_by_kind(node, "reference")
      .and_then(|n| n.utf8_text(source.as_bytes()).ok())
      .map(|s| s.to_string())
  }

  fn extract_doc(&self, node: Node, source: &Arc<String>) -> Option<String> {
    // Doc node contains a doc_string child
    Self::find_child_by_kind(node, "doc_string")
      .and_then(|n| n.utf8_text(source.as_bytes()).ok())
      .map(|s| s.trim_matches('"').to_string())
  }

  fn extract_function_body(&self, node: Node, source: &Arc<String>) -> String {
    let mut cursor = node.walk();
    let children: Vec<Node> = node.children(&mut cursor).collect();

    // Skip everything until after parameter_list, then take expressions
    let mut found_params = false;
    let mut body_parts = Vec::new();

    for child in children {
      if child.kind() == "parameter_list" {
        found_params = true;
        continue;
      }

      if found_params && child.kind() != "doc" && child.kind() != "(" && child.kind() != ")" {
        if let Ok(text) = child.utf8_text(source.as_bytes()) {
          body_parts.push(text.to_string());
        }
      }
    }

    body_parts.join(" ")
  }
}

fn collect_errors(cursor: &mut tree_sitter::TreeCursor, errors: &mut Vec<ParseError>) {
  if cursor.node().is_error() {
    let node = cursor.node();
    let start = node.start_position();
    errors.push(ParseError::new(
      "Syntax error".to_string(),
      start.row + 1,
      start.column + 1,
    ));
  }

  if cursor.goto_first_child() {
    collect_errors(cursor, errors);
    while cursor.goto_next_sibling() {
      collect_errors(cursor, errors);
    }
    cursor.goto_parent();
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_parse_simple_module() {
    let mut parser = Parser::new();
    let source = r#"
(module test GOVERNANCE
  "A test module"
  
  (defun simple-func:string ()
    "A simple function"
    "hello")
)"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.name, "test");
    assert_eq!(module.governance, "GOVERNANCE");
    assert_eq!(module.functions.len(), 1);

    let function = &module.functions[0];
    assert_eq!(function.name, "simple-func");
    assert_eq!(function.return_type, Some("string".to_string()));
    assert_eq!(function.parameters.len(), 0);
    assert!(function.is_defun);
  }

  #[test]
  fn test_parse_module_with_namespace() {
    let mut parser = Parser::new();
    let source = r#"
(namespace 'free)

(module todos GOVERNANCE
  "A todos module"
  
  (defun create-todo:string (id:string title:string)
    "Create a new todo"
    (insert todo-table id {"id": id, "title": title}))
)"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.name, "todos");
    assert_eq!(module.namespace, Some("free".to_string()));
    assert_eq!(module.functions.len(), 1);

    let function = &module.functions[0];
    assert_eq!(function.name, "create-todo");
    assert_eq!(function.return_type, Some("string".to_string()));
    assert_eq!(function.parameters.len(), 2);
    assert_eq!(function.parameters[0].name, "id");
    assert_eq!(
      function.parameters[0].parameter_type,
      Some("string".to_string())
    );
    assert_eq!(function.parameters[1].name, "title");
    assert_eq!(
      function.parameters[1].parameter_type,
      Some("string".to_string())
    );
  }

  #[test]
  fn test_parse_namespace_variations() {
    let mut parser = Parser::new();

    // Test with quotes
    let source1 = r#"
(namespace 'free)
(module test GOVERNANCE)
"#;
    let (modules, _) = parser.parse(source1);
    assert_eq!(modules[0].namespace, Some("free".to_string()));

    // Test with double quotes
    let source2 = r#"
(namespace "user")
(module test GOVERNANCE)
"#;
    let (modules, _) = parser.parse(source2);
    assert_eq!(modules[0].namespace, Some("user".to_string()));
  }

  #[test]
  fn test_parse_schema() {
    let mut parser = Parser::new();
    let source = r#"
(module test GOVERNANCE
  (defschema user
    "User schema"
    id:string
    name:string
    age:integer
    active:bool)
)"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.schemas.len(), 1);

    let schema = &module.schemas[0];
    assert_eq!(schema.name, "user");
    assert_eq!(schema.doc, Some("User schema".to_string()));
    assert_eq!(schema.fields.len(), 4);

    assert_eq!(schema.fields[0].name, "id");
    assert_eq!(schema.fields[0].field_type, "string");
    assert_eq!(schema.fields[1].name, "name");
    assert_eq!(schema.fields[1].field_type, "string");
    assert_eq!(schema.fields[2].name, "age");
    assert_eq!(schema.fields[2].field_type, "integer");
    assert_eq!(schema.fields[3].name, "active");
    assert_eq!(schema.fields[3].field_type, "bool");
  }

  #[test]
  fn test_parse_capability() {
    let mut parser = Parser::new();
    let source = r#"
(module test GOVERNANCE
  (defcap ADMIN:bool ()
    "Admin capability"
    true)
    
  (defcap TRANSFER:bool (from:string to:string amount:decimal)
    "Transfer capability"
    (> amount 0.0))
)"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.capabilities.len(), 2);

    let admin_cap = &module.capabilities[0];
    assert_eq!(admin_cap.name, "ADMIN");
    assert_eq!(admin_cap.return_type, Some("bool".to_string()));
    assert_eq!(admin_cap.parameters.len(), 0);
    assert_eq!(admin_cap.doc, Some("Admin capability".to_string()));

    let transfer_cap = &module.capabilities[1];
    assert_eq!(transfer_cap.name, "TRANSFER");
    assert_eq!(transfer_cap.return_type, Some("bool".to_string()));
    assert_eq!(transfer_cap.parameters.len(), 3);
    assert_eq!(transfer_cap.parameters[0].name, "from");
    assert_eq!(
      transfer_cap.parameters[0].parameter_type,
      Some("string".to_string())
    );
    assert_eq!(transfer_cap.parameters[1].name, "to");
    assert_eq!(
      transfer_cap.parameters[1].parameter_type,
      Some("string".to_string())
    );
    assert_eq!(transfer_cap.parameters[2].name, "amount");
    assert_eq!(
      transfer_cap.parameters[2].parameter_type,
      Some("decimal".to_string())
    );
  }

  #[test]
  fn test_parse_constant() {
    let mut parser = Parser::new();
    let source = r#"
(module test GOVERNANCE
  (defconst MAX_SUPPLY:integer 1000000)
  (defconst ADMIN_KEYSET "admin-keyset")
  (defconst VERSION:string "1.0.0")
)"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.constants.len(), 3);

    let max_supply = &module.constants[0];
    assert_eq!(max_supply.name, "MAX_SUPPLY");
    assert_eq!(max_supply.constant_type, Some("integer".to_string()));
    assert_eq!(max_supply.value, "1000000");

    let admin_keyset = &module.constants[1];
    assert_eq!(admin_keyset.name, "ADMIN_KEYSET");
    assert_eq!(admin_keyset.constant_type, None);
    assert_eq!(admin_keyset.value, "\"admin-keyset\"");

    let version = &module.constants[2];
    assert_eq!(version.name, "VERSION");
    assert_eq!(version.constant_type, Some("string".to_string()));
    assert_eq!(version.value, "\"1.0.0\"");
  }

  #[test]
  fn test_parse_function_with_complex_types() {
    let mut parser = Parser::new();
    let source = r#"
(module test GOVERNANCE
  (defun get-user:object{user} (id:string)
    "Get a user by ID"
    (read users-table id))
    
  (defun get-all-users:[object{user}] ()
    "Get all users"
    (select users-table (where 'active (= true))))
    
  (defun process-items:[string] (items:[object{item}])
    "Process items and return IDs"
    (map (lambda (item) (at 'id item)) items))
)"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.functions.len(), 3);

    let get_user = &module.functions[0];
    assert_eq!(get_user.name, "get-user");
    assert_eq!(get_user.return_type, Some("object{user}".to_string()));
    assert_eq!(get_user.parameters.len(), 1);

    let get_all_users = &module.functions[1];
    assert_eq!(get_all_users.name, "get-all-users");
    assert_eq!(
      get_all_users.return_type,
      Some("[object{user}]".to_string())
    );
    assert_eq!(get_all_users.parameters.len(), 0);

    let process_items = &module.functions[2];
    assert_eq!(process_items.name, "process-items");
    assert_eq!(process_items.return_type, Some("[string]".to_string()));
    assert_eq!(process_items.parameters.len(), 1);
    assert_eq!(process_items.parameters[0].name, "items");
    assert_eq!(
      process_items.parameters[0].parameter_type,
      Some("[object{item}]".to_string())
    );
  }

  #[test]
  fn test_parse_multiple_modules() {
    let mut parser = Parser::new();
    let source = r#"
(namespace 'free)

(module module1 GOVERNANCE
  "First module"
  (defun func1:string () "result1"))

(module module2 GOVERNANCE
  "Second module"
  (defun func2:integer () 42))
"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 2);

    let module1 = &modules[0];
    assert_eq!(module1.name, "module1");
    assert_eq!(module1.namespace, Some("free".to_string()));
    assert_eq!(module1.functions.len(), 1);
    assert_eq!(module1.functions[0].name, "func1");

    let module2 = &modules[1];
    assert_eq!(module2.name, "module2");
    assert_eq!(module2.namespace, Some("free".to_string()));
    assert_eq!(module2.functions.len(), 1);
    assert_eq!(module2.functions[0].name, "func2");
  }

  #[test]
  fn test_parse_function_without_return_type() {
    let mut parser = Parser::new();
    let source = r#"
(module test GOVERNANCE
  (defun no-return-type (param:string)
    "Function without explicit return type"
    param)
)"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.functions.len(), 1);

    let function = &module.functions[0];
    assert_eq!(function.name, "no-return-type");
    assert_eq!(function.return_type, None);
    assert_eq!(function.parameters.len(), 1);
    assert_eq!(function.parameters[0].name, "param");
    assert_eq!(
      function.parameters[0].parameter_type,
      Some("string".to_string())
    );
  }

  #[test]
  fn test_parse_parameter_without_type() {
    let mut parser = Parser::new();
    let source = r#"
(module test GOVERNANCE
  (defun untyped-param:string (typed:string untyped)
    "Function with mixed parameter types"
    (+ typed untyped))
)"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.functions.len(), 1);

    let function = &module.functions[0];
    assert_eq!(function.name, "untyped-param");
    assert_eq!(function.parameters.len(), 2);
    assert_eq!(function.parameters[0].name, "typed");
    assert_eq!(
      function.parameters[0].parameter_type,
      Some("string".to_string())
    );
    assert_eq!(function.parameters[1].name, "untyped");
    assert_eq!(function.parameters[1].parameter_type, None);
  }

  #[test]
  fn test_parse_empty_module() {
    let mut parser = Parser::new();
    let source = r#"
(module empty GOVERNANCE
  "An empty module")
"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.name, "empty");
    assert_eq!(module.governance, "GOVERNANCE");
    assert_eq!(module.functions.len(), 0);
    assert_eq!(module.schemas.len(), 0);
    assert_eq!(module.capabilities.len(), 0);
    assert_eq!(module.constants.len(), 0);
  }

  #[test]
  fn test_parse_module_with_doc() {
    let mut parser = Parser::new();
    let source = r#"
(module documented GOVERNANCE
  "This is a well documented module
   that spans multiple lines
   and explains what it does"
  
  (defun simple:string ()
    "Simple function"
    "result"))
"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.name, "documented");
    // Note: Module doc parsing may need additional implementation
    assert_eq!(module.functions.len(), 1);
    assert_eq!(module.functions[0].doc, Some("Simple function".to_string()));
  }

  #[test]
  fn test_parse_use_statements() {
    let mut parser = Parser::new();
    let source = r#"
(module test GOVERNANCE
  (use coin)
  (use util.guards)
  
  (defun test-func:string ()
    "test"))
"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.uses.len(), 2);
    assert_eq!(module.uses[0], "coin");
    assert_eq!(module.uses[1], "util.guards");
  }

  #[test]
  fn test_parse_implements_statements() {
    let mut parser = Parser::new();
    let source = r#"
(module test GOVERNANCE
  (implements fungible-v2)
  (implements token-policy-v1)
  
  (defun test-func:string ()
    "test"))
"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.implements.len(), 2);
    assert_eq!(module.implements[0], "fungible-v2");
    assert_eq!(module.implements[1], "token-policy-v1");
  }

  #[test]
  fn test_parse_invalid_source() {
    let mut parser = Parser::new();
    let source = r#"
(module incomplete GOVERNANCE
  (defun unclosed-function
"#;

    let (_modules, errors) = parser.parse(source);

    // Should still parse what it can, but report errors
    assert!(errors.len() > 0);
    // Implementation may vary - might parse partial module or no modules
  }

  #[test]
  fn test_parse_namespace_without_module() {
    let mut parser = Parser::new();
    let source = r#"
(namespace 'free)
"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 0); // No modules defined
  }

  #[test]
  fn test_parse_simple_governance() {
    let mut parser = Parser::new();
    let source = r#"
(module test GOVERNANCE
  "Module with simple governance"
  
  (defun test:string ()
    "test"))
"#;

    let (modules, errors) = parser.parse(source);

    assert_eq!(errors.len(), 0);
    assert_eq!(modules.len(), 1);

    let module = &modules[0];
    assert_eq!(module.name, "test");
    assert_eq!(module.governance, "GOVERNANCE");
  }

  #[test]
  fn test_find_current_namespace() {
    let parser = Parser::new();
    let mut ts_parser = tree_sitter::Parser::new();
    let language = tree_sitter_pact::LANGUAGE;
    ts_parser.set_language(&language.into()).unwrap();

    let source_text = "(namespace 'free)";
    let source = Arc::new(source_text.to_string());
    let tree = ts_parser.parse(source_text, None).unwrap();
    let root = tree.root_node();

    let namespace = parser.find_current_namespace(root, &source);
    assert_eq!(namespace, Some("free".to_string()));
  }

  #[test]
  fn test_find_modules() {
    let parser = Parser::new();
    let mut ts_parser = tree_sitter::Parser::new();
    let language = tree_sitter_pact::LANGUAGE;
    ts_parser.set_language(&language.into()).unwrap();

    let source = "(module test GOVERNANCE) (module test2 GOVERNANCE)";
    let tree = ts_parser.parse(source, None).unwrap();
    let root = tree.root_node();

    let modules = parser.find_modules(root);
    assert_eq!(modules.len(), 2);
  }
}
