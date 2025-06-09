use crate::optimized::arena::{Arena, OptVec, Symbol};
use crate::optimized::queries::{execute_query, fast_node_text, capture_indices, COMPILED_QUERIES};
use crate::optimized::types::*;
use tree_sitter::{Node, StreamingIterator};
use rayon::prelude::*;

/// High-performance parser using tree-sitter queries and arena allocation
pub struct OptimizedParser<'arena> {
    arena: &'arena Arena,
}

impl<'arena> OptimizedParser<'arena> {
    pub fn new(arena: &'arena Arena) -> Self {
        Self { arena }
    }

    /// Parse modules using optimized query-based approach
    pub fn parse_modules(&self, source: &[u8], root_node: Node) -> OptVec<OptPactModule<'arena>> {
        // First extract namespace
        let namespace = self.extract_namespace(source, root_node);

        // Extract all modules using compiled query
        execute_query(
            &COMPILED_QUERIES.modules,
            source,
            root_node,
            |matches| {
                let mut modules = OptVec::new();

                for query_match in matches {
                    if let Some(module) = self.parse_module_from_match(query_match, source, namespace.as_deref()) {
                        modules.push(module);
                    }
                }
                modules
            }
        )
    }

    /// Extract namespace using optimized query
    fn extract_namespace(&self, source: &[u8], root_node: Node) -> Option<String> {
        execute_query(
            &COMPILED_QUERIES.namespace,
            source,
            root_node,
            |matches| {
                for query_match in matches {
                    for capture in query_match.captures {
                        if capture.index == capture_indices::NAMESPACE_NAME {
                            if let Some(text) = fast_node_text(capture.node, source) {
                                return Some(self.clean_namespace(text));
                            }
                        }
                    }
                }
                None
            }
        )
    }

    /// Parse module from query match
    fn parse_module_from_match(
        &self,
        query_match: tree_sitter::QueryMatch,
        source: &[u8],
        namespace: Option<&str>,
    ) -> Option<OptPactModule<'arena>> {
        let mut name = None;
        let mut governance = None;
        let mut doc = None;
        let mut module_node = None;

        for capture in query_match.captures {
            match capture.index {
                capture_indices::MODULE_NAME => {
                    name = fast_node_text(capture.node, source);
                }
                capture_indices::MODULE_GOVERNANCE => {
                    governance = fast_node_text(capture.node, source);
                }
                capture_indices::MODULE_DOC => {
                    doc = fast_node_text(capture.node, source).map(|s| self.clean_doc_string(s));
                }
                capture_indices::MODULE_DEFINITION => {
                    module_node = Some(capture.node);
                }
                _ => {}
            }
        }

        let name = name?;
        let mut module = OptPactModule::new(name, namespace, self.arena);

        if let Some(gov) = governance {
            module.governance = Some(self.arena.intern_string(gov));
        }

        if let Some(doc_str) = doc {
            module.doc = Some(self.arena.alloc_str(&doc_str));
        }

        if let Some(node) = module_node {
            self.populate_module_contents(&mut module, source, node);
        }

        Some(module)
    }

    /// Populate module with functions, schemas, and capabilities
    fn populate_module_contents(&self, module: &mut OptPactModule<'arena>, source: &[u8], module_node: Node) {
        // Note: Parallel parsing was removed because the arena is not thread-safe.
        // If performance is critical, consider using a thread-safe arena like `im` or `arc-swap`.
        self.parse_functions(source, module_node, module.path, &mut module.functions);
        self.parse_schemas(source, module_node, &mut module.schemas);
        self.parse_capabilities(source, module_node, &mut module.capabilities);
    }

    /// Parse functions using optimized query
    fn parse_functions(
        &self,
        source: &[u8],
        module_node: Node,
        module_path: &'arena str,
        functions: &mut OptVec<OptPactFunction<'arena>>,
    ) {
        execute_query(
            &COMPILED_QUERIES.functions,
            source,
            module_node,
            |matches| {
                for query_match in matches {
                    if let Some(function) = self.parse_function_from_match(query_match, source, module_path) {
                        functions.push(function);
                    }
                }
            }
        );
    }

    /// Parse function from query match with parameter extraction
    fn parse_function_from_match(
        &self,
        query_match: tree_sitter::QueryMatch,
        source: &[u8],
        module_path: &'arena str,
    ) -> Option<OptPactFunction<'arena>> {
        let mut name = None;
        let mut doc = None;
        let mut return_type = None;
        let mut parameters_node = None;
        let mut body_node = None;

        for capture in query_match.captures {
            match capture.index {
                capture_indices::FUNCTION_NAME => {
                    name = fast_node_text(capture.node, source);
                }
                capture_indices::FUNCTION_DOC => {
                    doc = fast_node_text(capture.node, source).map(|s| self.clean_doc_string(s));
                }
                capture_indices::FUNCTION_RETURN_TYPE => {
                    return_type = self.extract_return_type(capture.node, source);
                }
                capture_indices::FUNCTION_PARAMETERS => {
                    parameters_node = Some(capture.node);
                }
                capture_indices::FUNCTION_BODY => {
                    body_node = Some(capture.node);
                }
                _ => {}
            }
        }

        let name = name?;
        let mut function = OptPactFunction::new(name, module_path, self.arena);

        if let Some(doc_str) = doc {
            function.doc = Some(self.arena.alloc_str(&doc_str));
        }

        if let Some(ret_type) = return_type {
            function.return_type = self.arena.intern_string(&ret_type);
        }

        // Parse parameters if present
        if let Some(params_node) = parameters_node {
            self.parse_parameters(source, params_node, &mut function.parameters);
        }

        // Extract required capabilities from body
        if let Some(body) = body_node {
            self.extract_required_capabilities(source, body, &mut function.required_capabilities);
        }

        Some(function)
    }

    /// Parse parameters using optimized approach
    fn parse_parameters(
        &self,
        source: &[u8],
        params_node: Node,
        parameters: &mut OptVec<OptPactParameter<'arena>>,
    ) {
        execute_query(
            &COMPILED_QUERIES.parameters,
            source,
            params_node,
            |matches| {
                for query_match in matches {
                    let mut param_name = None;
                    let mut param_type = None;

                    for capture in query_match.captures {
                        match capture.index {
                            capture_indices::PARAMETER_NAME => {
                                param_name = fast_node_text(capture.node, source);
                            }
                            capture_indices::PARAMETER_TYPE => {
                                param_type = self.extract_type_from_node(capture.node, source);
                            }
                            _ => {}
                        }
                    }

                    if let (Some(name), Some(ptype)) = (param_name, param_type) {
                        let param = OptPactParameter::new(name, ptype, self.arena);
                        parameters.push(param);
                    }
                }
            }
        );
    }

    /// Parse schemas using optimized query
    fn parse_schemas(
        &self,
        source: &[u8],
        module_node: Node,
        schemas: &mut OptVec<OptPactSchema<'arena>>,
    ) {
        execute_query(
            &COMPILED_QUERIES.schemas,
            source,
            module_node,
            |matches| {
                for query_match in matches {
                    if let Some(schema) = self.parse_schema_from_match(query_match, source) {
                        schemas.push(schema);
                    }
                }
            }
        );
    }

    /// Parse schema from query match
    fn parse_schema_from_match(
        &self,
        query_match: tree_sitter::QueryMatch,
        source: &[u8],
    ) -> Option<OptPactSchema<'arena>> {
        let mut name = None;
        let mut doc = None;
        let mut fields_node = None;

        for capture in query_match.captures {
            match capture.index {
                capture_indices::SCHEMA_NAME => {
                    name = fast_node_text(capture.node, source);
                }
                capture_indices::SCHEMA_DOC => {
                    doc = fast_node_text(capture.node, source).map(|s| self.clean_doc_string(s));
                }
                capture_indices::SCHEMA_FIELDS => {
                    fields_node = Some(capture.node);
                }
                _ => {}
            }
        }

        let name = name?;
        let mut schema = OptPactSchema::new(name, self.arena);

        if let Some(doc_str) = doc {
            schema.doc = Some(self.arena.alloc_str(&doc_str));
        }

        // Parse schema fields
        if let Some(fields) = fields_node {
            self.parse_schema_fields(source, fields, &mut schema.fields);
        }

        Some(schema)
    }

    /// Parse schema fields
    fn parse_schema_fields(
        &self,
        source: &[u8],
        fields_node: Node,
        fields: &mut OptVec<OptPactSchemaField<'arena>>,
    ) {
        execute_query(
            &COMPILED_QUERIES.schema_fields,
            source,
            fields_node,
            |matches| {
                for query_match in matches {
                    let mut field_name = None;
                    let mut field_type = None;

                    for capture in query_match.captures {
                        match capture.index {
                            capture_indices::FIELD_NAME => {
                                field_name = fast_node_text(capture.node, source);
                            }
                            capture_indices::FIELD_TYPE => {
                                field_type = self.extract_type_from_node(capture.node, source);
                            }
                            _ => {}
                        }
                    }

                    if let (Some(name), Some(ftype)) = (field_name, field_type) {
                        let field = OptPactSchemaField::new(name, ftype, self.arena);
                        fields.push(field);
                    }
                }
            }
        );
    }

    /// Parse capabilities
    fn parse_capabilities(
        &self,
        source: &[u8],
        module_node: Node,
        capabilities: &mut OptVec<OptPactCapability<'arena>>,
    ) {
        execute_query(
            &COMPILED_QUERIES.capabilities,
            source,
            module_node,
            |matches| {
                for query_match in matches {
                    if let Some(capability) = self.parse_capability_from_match(query_match, source) {
                        capabilities.push(capability);
                    }
                }
            }
        );
    }

    /// Parse capability from query match
    fn parse_capability_from_match(
        &self,
        query_match: tree_sitter::QueryMatch,
        source: &[u8],
    ) -> Option<OptPactCapability<'arena>> {
        let mut name = None;
        let mut doc = None;
        let mut parameters_node = None;

        for capture in query_match.captures {
            match capture.index {
                0 => name = fast_node_text(capture.node, source), // capability name
                1 => parameters_node = Some(capture.node),       // parameters
                2 => doc = fast_node_text(capture.node, source).map(|s| self.clean_doc_string(s)), // doc
                _ => {}
            }
        }

        let name = name?;
        let mut capability = OptPactCapability::new(name, self.arena);

        if let Some(doc_str) = doc {
            capability.doc = Some(self.arena.alloc_str(&doc_str));
        }

        if let Some(params_node) = parameters_node {
            self.parse_parameters(source, params_node, &mut capability.parameters);
        }

        Some(capability)
    }

    // Helper methods for optimization

    #[inline]
    fn clean_namespace(&self, namespace: &str) -> String {
        let trimmed = namespace.trim();
        if trimmed.starts_with('\'') && trimmed.len() > 1 {
            trimmed[1..].to_string()
        } else if (trimmed.starts_with('"') && trimmed.ends_with('"')) ||
                  (trimmed.starts_with('\'') && trimmed.ends_with('\'')) {
            trimmed[1..trimmed.len()-1].to_string()
        } else {
            trimmed.to_string()
        }
    }

    #[inline]
    fn clean_doc_string(&self, doc: &str) -> String {
        let trimmed = doc.trim();
        if (trimmed.starts_with('"') && trimmed.ends_with('"')) ||
           (trimmed.starts_with('\'') && trimmed.ends_with('\'')) {
            trimmed[1..trimmed.len()-1].to_string()
        } else {
            trimmed.to_string()
        }
    }

    #[inline]
    fn extract_return_type(&self, node: Node, source: &[u8]) -> Option<String> {
        execute_query(
            &COMPILED_QUERIES.return_types,
            source,
            node,
            |matches| {
                for query_match in matches {
                    for capture in query_match.captures {
                        return fast_node_text(capture.node, source).map(|s| s.to_string());
                    }
                }
                None
            }
        )
    }

    #[inline]
    fn extract_type_from_node(&self, node: Node, source: &[u8]) -> Option<&str> {
        // First try direct text extraction
        if let Some(text) = fast_node_text(node, source) {
            return Some(text);
        }

        // Fall back to searching for type_identifier children
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "type_identifier" {
                return fast_node_text(child, source);
            }
        }

        None
    }

    fn extract_required_capabilities(
        &self,
        source: &[u8],
        body_node: Node,
        capabilities: &mut OptVec<Symbol>,
    ) {
        execute_query(
            &COMPILED_QUERIES.required_capabilities,
            source,
            body_node,
            |matches| {
                for query_match in matches {
                    for capture in query_match.captures {
                        if let Some(text) = fast_node_text(capture.node, source) {
                            let symbol = self.arena.intern_string(text);
                            capabilities.push(symbol);
                        }
                    }
                }
            }
        );
    }
}
