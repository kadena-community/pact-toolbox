use tree_sitter::Node;
use std::collections::HashMap;
use crate::types::PactModule;

/// Type mapping from Pact types to TypeScript types
pub fn get_type_map() -> HashMap<&'static str, &'static str> {
    let mut map = HashMap::new();
    map.insert("integer", "number");
    map.insert("decimal", "number");
    map.insert("time", "Date");
    map.insert("bool", "boolean");
    map.insert("string", "string");
    map.insert("list", "unknown[]");
    map.insert("keyset", "object");
    map.insert("guard", "object");
    map.insert("object", "Record<string, unknown>");
    map.insert("table", "Record<string, unknown>");
    map
}

/// Maps Pact types to TypeScript types
pub fn pact_type_to_typescript_type(pact_type: &str, module: &PactModule) -> String {
    if pact_type.starts_with('{') || pact_type.starts_with("object{") {
        let schema_name = if pact_type.starts_with('{') {
            &pact_type[1..pact_type.len()-1]
        } else {
            &pact_type[7..pact_type.len()-1]
        };

        if let Some(_schema) = module.get_schema(schema_name) {
            return to_pascal_case(schema_name);
        }
        return "Record<string, unknown>".to_string();
    }

    if pact_type.starts_with('[') {
        let inner_type = &pact_type[1..pact_type.len()-1];
        if !inner_type.is_empty() {
            return format!("{}[]", pact_type_to_typescript_type(inner_type, module));
        }
        return "unknown[]".to_string();
    }

    let type_map = get_type_map();
    type_map.get(pact_type).unwrap_or(&"unknown").to_string()
}

/// Extract namespace from the root node
pub fn get_namespace_of(node: &Node, source: &str) -> Option<String> {
    let mut cursor = node.walk();

    for child in node.children(&mut cursor) {
        if child.kind() == "namespace" {
            if let Some(namespace_node) = child.child_by_field_name("namespace") {
                if let Ok(text) = namespace_node.utf8_text(source.as_bytes()) {
                    let namespace = text.trim();
                    // Remove quotes if present
                    if namespace.starts_with('\'') && namespace.len() > 1 {
                        return Some(namespace[1..].to_string());
                    }
                    if (namespace.starts_with('"') && namespace.ends_with('"')) ||
                       (namespace.starts_with('\'') && namespace.ends_with('\'')) {
                        return Some(namespace[1..namespace.len()-1].to_string());
                    }
                    return Some(namespace.to_string());
                }
            }
        }
    }

    None
}

/// Extract return type from a function node
pub fn get_return_type_of(node: &Node, source: &str) -> String {
    if let Some(return_type_node) = node.child_by_field_name("return_type") {
        let mut cursor = return_type_node.walk();
        for child in return_type_node.children(&mut cursor) {
            if child.kind() == "type_identifier" {
                if let Ok(text) = child.utf8_text(source.as_bytes()) {
                    return text.to_string();
                }
            }
        }
    }
    "void".to_string()
}

/// Extract text content from a node
pub fn get_node_text(node: &Node, source: &str) -> Option<String> {
    node.utf8_text(source.as_bytes()).ok().map(|s| s.to_string())
}

/// Extract documentation string from a node
pub fn get_doc_string(node: &Node, source: &str) -> Option<String> {
    if let Some(doc_node) = node.child_by_field_name("doc") {
        let mut cursor = doc_node.walk();
        for child in doc_node.children(&mut cursor) {
            if child.kind() == "doc_string" {
                if let Ok(text) = child.utf8_text(source.as_bytes()) {
                    return Some(clean_doc_string(text));
                }
            }
        }
    }
    None
}

/// Clean and format documentation string
pub fn clean_doc_string(doc: &str) -> String {
    let mut trimmed = doc.trim().to_string();

    // Remove surrounding quotes
    if (trimmed.starts_with('"') && trimmed.ends_with('"')) ||
       (trimmed.starts_with('\'') && trimmed.ends_with('\'')) {
        trimmed = trimmed[1..trimmed.len()-1].to_string();
    }

    // Replace backslash line continuations
    trimmed = trimmed.replace("\\\n", " ");
    trimmed = trimmed.replace("\\\\", " ");

    trimmed
}

/// Convert documentation string to JSDoc format
pub fn convert_to_jsdoc(input_str: Option<&str>) -> String {
    let Some(input_str) = input_str else {
        return String::new();
    };

    let cleaned = clean_doc_string(input_str);
    if cleaned.is_empty() {
        return String::new();
    }

    // Split into lines for JSDoc formatting
    let lines: Vec<&str> = cleaned.split(". ").collect();
    let jsdoc_lines: Vec<String> = lines.iter()
        .map(|line| format!(" * {}", line.trim()))
        .collect();

    format!("/**\n{}\n */\n", jsdoc_lines.join("\n"))
}

/// Convert string to camelCase
pub fn to_camel_case(s: &str) -> String {
    if s.is_empty() {
        return String::new();
    }

    let words: Vec<&str> = s.split(&['-', '_', ' '][..]).filter(|w| !w.is_empty()).collect();
    if words.is_empty() {
        return s.to_string();
    }

    let first = words[0].to_lowercase();
    let rest: Vec<String> = words.iter().skip(1)
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
            }
        })
        .collect();

    first + &rest.join("")
}

/// Convert string to PascalCase
pub fn to_pascal_case(s: &str) -> String {
    if s.is_empty() {
        return String::new();
    }

    let words: Vec<&str> = s.split(&['-', '_', ' '][..]).filter(|w| !w.is_empty()).collect();
    words.iter()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
            }
        })
        .collect::<Vec<String>>()
        .join("")
}
