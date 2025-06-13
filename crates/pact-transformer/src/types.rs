use ahash::AHashMap;
use once_cell::sync::Lazy;

pub static PACT_TO_TS_TYPE_MAP: Lazy<AHashMap<&'static str, &'static str>> = Lazy::new(|| {
    let mut map = AHashMap::new();
    map.insert("integer", "number");
    map.insert("decimal", "number");
    map.insert("string", "string");
    map.insert("bool", "boolean");
    map.insert("time", "Date");
    map.insert("keyset", "Keyset");
    map.insert("guard", "Guard");
    map.insert("value", "any");
    map.insert("module", "Module");
    map
});

pub fn pact_type_to_typescript(pact_type: &str) -> String {
    // Handle parameterized types
    if pact_type.contains('[') && pact_type.contains(']') {
        let start = pact_type.find('[').unwrap();
        let end = pact_type.find(']').unwrap();
        let inner_type = &pact_type[start + 1..end];
        let mapped_inner = pact_type_to_typescript(inner_type);
        return format!("{}[]", mapped_inner);
    }

    // Handle object types with parameters
    if pact_type.starts_with("object{") {
        let type_param = pact_type.strip_prefix("object{").unwrap().strip_suffix('}').unwrap();
        return format!("Record<string, {}>", pact_type_to_typescript(type_param));
    }

    // Handle table types
    if pact_type.starts_with("table{") {
        let schema = pact_type.strip_prefix("table{").unwrap().strip_suffix('}').unwrap();
        return format!("Table<{}>", schema);
    }

    // Handle module types
    if pact_type.starts_with("module{") {
        let interfaces = pact_type.strip_prefix("module{").unwrap().strip_suffix('}').unwrap();
        return format!("Module<{}>", interfaces);
    }

    // Map basic types
    PACT_TO_TS_TYPE_MAP.get(pact_type).unwrap_or(&"any").to_string()
}

pub fn convert_to_jsdoc(doc: Option<&str>) -> String {
    match doc {
        Some(text) => {
            let lines: Vec<String> = text.lines().map(|line| format!(" * {}", line)).collect();

            if lines.is_empty() {
                String::new()
            } else {
                format!("/**\n{}\n */\n", lines.join("\n"))
            }
        }
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_type_mapping() {
        assert_eq!(pact_type_to_typescript("integer"), "number");
        assert_eq!(pact_type_to_typescript("decimal"), "number");
        assert_eq!(pact_type_to_typescript("string"), "string");
        assert_eq!(pact_type_to_typescript("bool"), "boolean");
        assert_eq!(pact_type_to_typescript("time"), "Date");
        assert_eq!(pact_type_to_typescript("unknown"), "any");
    }

    #[test]
    fn test_list_type_mapping() {
        assert_eq!(pact_type_to_typescript("[integer]"), "number[]");
        assert_eq!(pact_type_to_typescript("[string]"), "string[]");
    }

    #[test]
    fn test_object_type_mapping() {
        assert_eq!(pact_type_to_typescript("object{integer}"), "Record<string, number>");
        assert_eq!(pact_type_to_typescript("table{account}"), "Table<account>");
    }

    #[test]
    fn test_jsdoc_conversion() {
        assert_eq!(convert_to_jsdoc(None), "");
        assert_eq!(convert_to_jsdoc(Some("Test function")), "/**\n * Test function\n */\n");
        assert_eq!(convert_to_jsdoc(Some("Line 1\nLine 2")), "/**\n * Line 1\n * Line 2\n */\n");
    }
}
