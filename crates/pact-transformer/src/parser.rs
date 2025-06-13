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
        ts_parser.set_language(&language.into()).expect("Error loading Pact grammar");

        Self { ts_parser }
    }

    pub fn parse(&mut self, source: &str) -> (Vec<PactModule>, Vec<ParseError>) {
        let tree = match self.ts_parser.parse(source, None) {
            Some(tree) => tree,
            None => {
                return (vec![], vec![ParseError::new("Failed to parse".to_string(), 0, 0)]);
            }
        };

        let root_node = tree.root_node();
        let mut errors = Vec::new();

        // Collect parse errors
        if root_node.has_error() {
            let mut cursor = root_node.walk();
            collect_errors(&mut cursor, &mut errors);
        }

        // Extract modules in parallel
        let module_nodes = self.find_modules(root_node);
        let source_arc = Arc::new(source.to_string());

        let modules: Vec<PactModule> = module_nodes
            .into_par_iter()
            .filter_map(|node| self.parse_module(node, &source_arc))
            .collect();

        (modules, errors)
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

    fn parse_module(&self, node: Node, source: &Arc<String>) -> Option<PactModule> {
        // Extract module name and governance using named fields
        let name = Self::find_child_by_kind(node, "module_identifier")?
            .utf8_text(source.as_bytes())
            .ok()?
            .to_string();

        let governance = Self::find_child_by_kind(node, "module_governance")?
            .utf8_text(source.as_bytes())
            .ok()?
            .to_string();

        let mut module = PactModule::new(name, governance);

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

                (functions, capabilities, schemas, constants, uses, implements, docs)
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
        let name = name_with_type_node.utf8_text(source.as_bytes()).ok()?.to_string();

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
                            let parameter =
                                param_node.utf8_text(source.as_bytes()).ok()?.to_string();
                            let manager_function = children
                                .get(i + 2)
                                .filter(|n| n.kind() == "reference")
                                .and_then(|n| n.utf8_text(source.as_bytes()).ok())
                                .map(|s| s.to_string());
                            capability.managed = Some(ManagedInfo { parameter, manager_function });
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

        let mut schema = PactSchema { name, doc: None, fields: Vec::new() };

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

        let mut constant = PactConstant { name, doc: None, constant_type, value };

        // Check for doc
        if let Some(doc_node) = Self::find_child_by_kind(node, "doc") {
            constant.doc = self.extract_doc(doc_node, source);
        }

        Some(constant)
    }

    fn parse_parameters(&self, node: Node, source: &Arc<String>) -> Vec<PactParameter> {
        let mut cursor = node.walk();
        node.children(&mut cursor)
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

        Some(PactParameter { name, parameter_type })
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
        errors.push(ParseError::new("Syntax error".to_string(), start.row + 1, start.column + 1));
    }

    if cursor.goto_first_child() {
        collect_errors(cursor, errors);
        while cursor.goto_next_sibling() {
            collect_errors(cursor, errors);
        }
        cursor.goto_parent();
    }
}
