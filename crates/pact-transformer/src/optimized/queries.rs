use once_cell::sync::Lazy;
use std::cell::RefCell;
use tree_sitter::{Language, Query, QueryCursor};

/// Pre-compiled queries for maximum performance
pub struct CompiledQueries {
    pub modules: Query,
    pub functions: Query,
    pub schemas: Query,
    pub capabilities: Query,
    pub parameters: Query,
    pub schema_fields: Query,
    pub namespace: Query,
    pub return_types: Query,
    pub required_capabilities: Query,
}

impl CompiledQueries {
    fn new(language: Language) -> Result<Self, tree_sitter::QueryError> {
        Ok(Self {
            modules: Query::new(&language, MODULES_QUERY)?,
            functions: Query::new(&language, FUNCTIONS_QUERY)?,
            schemas: Query::new(&language, SCHEMAS_QUERY)?,
            capabilities: Query::new(&language, CAPABILITIES_QUERY)?,
            parameters: Query::new(&language, PARAMETERS_QUERY)?,
            schema_fields: Query::new(&language, SCHEMA_FIELDS_QUERY)?,
            namespace: Query::new(&language, NAMESPACE_QUERY)?,
            return_types: Query::new(&language, RETURN_TYPES_QUERY)?,
            required_capabilities: Query::new(&language, REQUIRED_CAPABILITIES_QUERY)?,
        })
    }
}

/// Global lazy-initialized compiled queries
pub static COMPILED_QUERIES: Lazy<CompiledQueries> = Lazy::new(|| {
    CompiledQueries::new(tree_sitter_pact::LANGUAGE.into())
        .expect("Failed to compile tree-sitter queries")
});

/// Query string for extracting modules
const MODULES_QUERY: &str = r#"
(module
  name: (identifier) @module.name
  governance: (_)? @module.governance
  doc: (doc_string)? @module.doc
) @module.definition
"#;

/// Query string for extracting functions
const FUNCTIONS_QUERY: &str = r#"
(defun
  name: (identifier) @function.name
  parameters: (parameter_list)? @function.parameters
  return_type: (type_annotation)? @function.return_type
  doc: (doc_string)? @function.doc
  body: (_) @function.body
) @function.definition
"#;

/// Query string for extracting schemas
const SCHEMAS_QUERY: &str = r#"
(defschema
  name: (identifier) @schema.name
  doc: (doc_string)? @schema.doc
  fields: (schema_field_list) @schema.fields
) @schema.definition
"#;

/// Query string for extracting capabilities
const CAPABILITIES_QUERY: &str = r#"
(defcap
  name: (identifier) @capability.name
  parameters: (parameter_list)? @capability.parameters
  doc: (doc_string)? @capability.doc
  body: (_) @capability.body
) @capability.definition
"#;

/// Query string for extracting parameters
const PARAMETERS_QUERY: &str = r#"
(parameter
  name: (identifier) @parameter.name
  type: (type_annotation) @parameter.type
) @parameter.definition
"#;

/// Query string for extracting schema fields
const SCHEMA_FIELDS_QUERY: &str = r#"
(schema_field
  name: (identifier) @field.name
  type: (type_annotation) @field.type
) @field.definition
"#;

/// Query string for extracting namespace
const NAMESPACE_QUERY: &str = r#"
(namespace
  namespace: (_) @namespace.name
) @namespace.definition
"#;

/// Query string for extracting return types
const RETURN_TYPES_QUERY: &str = r#"
(type_annotation
  (type_identifier) @return_type
)
"#;

/// Query string for finding required capabilities
const REQUIRED_CAPABILITIES_QUERY: &str = r#"
(s_expression
  head: (s_expression_head) @caller
  (#any-of? @caller
    "with-capability" "require-capability" "compose-capability" "install-capability"
  )
  tail: (s_expression
    (s_expression_head) @capability_name
  )*
) @capability_call
"#;

/// Query capture indices for fast access
pub mod capture_indices {
    // Module captures
    pub const MODULE_NAME: u32 = 0;
    pub const MODULE_GOVERNANCE: u32 = 1;
    pub const MODULE_DOC: u32 = 2;
    pub const MODULE_DEFINITION: u32 = 3;

    // Function captures
    pub const FUNCTION_NAME: u32 = 0;
    pub const FUNCTION_PARAMETERS: u32 = 1;
    pub const FUNCTION_RETURN_TYPE: u32 = 2;
    pub const FUNCTION_DOC: u32 = 3;
    pub const FUNCTION_BODY: u32 = 4;
    pub const FUNCTION_DEFINITION: u32 = 5;

    // Schema captures
    pub const SCHEMA_NAME: u32 = 0;
    pub const SCHEMA_DOC: u32 = 1;
    pub const SCHEMA_FIELDS: u32 = 2;
    pub const SCHEMA_DEFINITION: u32 = 3;

    // Parameter captures
    pub const PARAMETER_NAME: u32 = 0;
    pub const PARAMETER_TYPE: u32 = 1;
    pub const PARAMETER_DEFINITION: u32 = 2;

    // Field captures
    pub const FIELD_NAME: u32 = 0;
    pub const FIELD_TYPE: u32 = 1;
    pub const FIELD_DEFINITION: u32 = 2;

    // Namespace captures
    pub const NAMESPACE_NAME: u32 = 0;
    pub const NAMESPACE_DEFINITION: u32 = 1;
}

/// Thread-local query cursor for reuse
thread_local! {
    static QUERY_CURSOR: RefCell<QueryCursor> = RefCell::new(QueryCursor::new());
}

/// Execute a query with cursor reuse for better performance
pub fn execute_query<F, R>(query: &Query, source: &[u8], root_node: tree_sitter::Node, f: F) -> R
where
    F: FnOnce(tree_sitter::QueryMatches<'_, '_, &[u8], &'_ [u8]>) -> R,
{
    QUERY_CURSOR.with(|cursor| {
        let mut cursor = cursor.borrow_mut();
        cursor.set_byte_range(0..source.len());
        let matches = cursor.matches(query, root_node, source);
        f(matches)
    })
}

/// Fast text extraction from node using memchr for optimization
#[inline]
pub fn fast_node_text<'a>(node: tree_sitter::Node, source: &'a [u8]) -> Option<&'a str> {
    let start = node.start_byte();
    let end = node.end_byte();

    if start <= end && end <= source.len() {
        std::str::from_utf8(&source[start..end]).ok()
    } else {
        None
    }
}

/// Check if a node kind matches any of the given kinds (optimized)
#[inline]
pub fn node_kind_matches(node: tree_sitter::Node, kinds: &[&str]) -> bool {
    let node_kind = node.kind();
    kinds.iter().any(|&kind| node_kind == kind)
}
