use tree_sitter::Node;
use crate::error::TransformerError;
use crate::types::*;
use crate::utils;

/// Parse a module node into a PactModule struct
pub fn parse_module(node: &Node, source: &str, namespace: Option<&str>) -> Result<PactModule, TransformerError> {
    let name = node.child_by_field_name("name")
        .and_then(|n| utils::get_node_text(&n, source))
        .ok_or_else(|| TransformerError::MissingField("module name".to_string()))?;

    let mut module = PactModule::new(name, namespace.map(|s| s.to_string()));

    // Extract governance
    if let Some(governance_node) = node.child_by_field_name("governance") {
        module.governance = utils::get_node_text(&governance_node, source);
    }

    // Extract documentation
    module.doc = utils::get_doc_string(node, source);

    // Parse child nodes
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "defschema" => {
                let schema = parse_schema(&child, source)?;
                module.schemas.push(schema);
            }
            "defcap" => {
                let capability = parse_capability(&child, source)?;
                module.capabilities.push(capability);
            }
            "defun" => {
                let function = parse_function(&child, source, &module.path)?;
                module.functions.push(function);
            }
            _ => {} // Ignore other node types
        }
    }

    Ok(module)
}

/// Parse a function definition node
pub fn parse_function(node: &Node, source: &str, module_path: &str) -> Result<PactFunction, TransformerError> {
    let name = node.child_by_field_name("name")
        .and_then(|n| utils::get_node_text(&n, source))
        .ok_or_else(|| TransformerError::MissingField("function name".to_string()))?;

    let mut function = PactFunction::new(name, module_path);

    // Extract documentation
    function.doc = utils::get_doc_string(node, source);

    // Extract return type
    function.return_type = utils::get_return_type_of(node, source);

    // Parse parameters
    if let Some(params_node) = node.child_by_field_name("parameters") {
        let mut cursor = params_node.walk();
        for child in params_node.children(&mut cursor) {
            if child.kind() == "parameter" {
                let parameter = parse_parameter(&child, source)?;
                function.parameters.push(parameter);
            }
        }
    }

    // Parse body for required capabilities (simplified for now)
    function.required_capabilities = extract_required_capabilities(node, source);

    Ok(function)
}

/// Parse a parameter node
pub fn parse_parameter(node: &Node, source: &str) -> Result<PactParameter, TransformerError> {
    let name = node.child_by_field_name("name")
        .and_then(|n| utils::get_node_text(&n, source))
        .ok_or_else(|| TransformerError::MissingField("parameter name".to_string()))?;

    let param_type = node.child_by_field_name("type")
        .and_then(|type_node| {
            let mut cursor = type_node.walk();
            for child in type_node.children(&mut cursor) {
                if child.kind() == "type_identifier" {
                    return utils::get_node_text(&child, source);
                }
            }
            None
        })
        .unwrap_or_else(|| "unknown".to_string());

    Ok(PactParameter {
        name,
        param_type,
    })
}

/// Parse a schema definition node
pub fn parse_schema(node: &Node, source: &str) -> Result<PactSchema, TransformerError> {
    let name = node.child_by_field_name("name")
        .and_then(|n| utils::get_node_text(&n, source))
        .ok_or_else(|| TransformerError::MissingField("schema name".to_string()))?;

    let mut schema = PactSchema::new(name);

    // Extract documentation
    schema.doc = utils::get_doc_string(node, source);

    // Parse fields
    if let Some(fields_node) = node.child_by_field_name("fields") {
        let mut cursor = fields_node.walk();
        for child in fields_node.children(&mut cursor) {
            if child.kind() == "schema_field" {
                let field = parse_schema_field(&child, source)?;
                schema.fields.push(field);
            }
        }
    }

    Ok(schema)
}

/// Parse a schema field node
pub fn parse_schema_field(node: &Node, source: &str) -> Result<PactSchemaField, TransformerError> {
    let name = node.child_by_field_name("name")
        .and_then(|n| utils::get_node_text(&n, source))
        .ok_or_else(|| TransformerError::MissingField("field name".to_string()))?;

    let field_type = find_type_identifier(node, source)
        .unwrap_or_else(|| "unknown".to_string());

    Ok(PactSchemaField {
        name,
        field_type,
    })
}

/// Parse a capability definition node
pub fn parse_capability(node: &Node, source: &str) -> Result<PactCapability, TransformerError> {
    let name = node.child_by_field_name("name")
        .and_then(|n| utils::get_node_text(&n, source))
        .ok_or_else(|| TransformerError::MissingField("capability name".to_string()))?;

    let mut capability = PactCapability::new(name);

    // Extract documentation
    capability.doc = utils::get_doc_string(node, source);

    // Parse parameters
    if let Some(params_node) = node.child_by_field_name("parameters") {
        let mut cursor = params_node.walk();
        for child in params_node.children(&mut cursor) {
            if child.kind() == "parameter" {
                let parameter = parse_parameter(&child, source)?;
                capability.parameters.push(parameter);
            }
        }
    }

    Ok(capability)
}

/// Find type identifier in a node's descendants
fn find_type_identifier(node: &Node, source: &str) -> Option<String> {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "type_identifier" {
            return utils::get_node_text(&child, source);
        }
        // Recursively search in child nodes
        if let Some(found) = find_type_identifier(&child, source) {
            return Some(found);
        }
    }
    None
}

/// Extract required capabilities from function body (simplified implementation)
fn extract_required_capabilities(node: &Node, source: &str) -> Vec<String> {
    let mut capabilities = Vec::new();

    fn search_capabilities(node: &Node, source: &str, capabilities: &mut Vec<String>) {
        // Look for function calls that might indicate capability requirements
        if node.kind() == "s_expression" {
            if let Some(head) = node.child(0) {
                if let Ok(text) = head.utf8_text(source.as_bytes()) {
                    if matches!(text, "with-capability" | "require-capability" | "compose-capability" | "install-capability") {
                        // Extract capability name from the second argument
                        if let Some(cap_arg) = node.child(1) {
                            if let Ok(cap_text) = cap_arg.utf8_text(source.as_bytes()) {
                                capabilities.push(cap_text.to_string());
                            }
                        }
                    }
                }
            }
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            search_capabilities(&child, source, capabilities);
        }
    }

    search_capabilities(node, source, &mut capabilities);
    capabilities
}
