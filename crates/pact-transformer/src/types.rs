use ahash::AHashMap;
use std::sync::LazyLock;

pub static PACT_TO_TS_TYPE_MAP: LazyLock<AHashMap<&'static str, &'static str>> =
  LazyLock::new(|| {
    let mut map = AHashMap::new();
    map.insert("integer", "number");
    map.insert("decimal", "number");
    map.insert("string", "string");
    map.insert("bool", "boolean");
    map.insert("time", "Date");
    map.insert("keyset", "object");
    map.insert("guard", "object");
    map.insert("list", "unknown[]");
    map.insert("object", "Record<string, unknown>");
    map.insert("table", "Record<string, unknown>");
    map.insert("value", "unknown");
    map.insert("module", "unknown");
    map
  });

pub fn pact_type_to_typescript(pact_type: &str) -> String {
  // Handle schema references like {todo} - return PascalCase schema name
  if pact_type.starts_with('{') && pact_type.ends_with('}') {
    let schema_name = &pact_type[1..pact_type.len() - 1];
    return to_pascal_case(schema_name);
  }

  // Handle object types with schema like object{todo}
  if pact_type.starts_with("object{") && pact_type.ends_with('}') {
    let schema_name = &pact_type[7..pact_type.len() - 1];
    return to_pascal_case(schema_name);
  }

  // Handle list types like [object{todo}] or [string]
  if pact_type.starts_with('[') && pact_type.ends_with(']') {
    let inner_type = &pact_type[1..pact_type.len() - 1];
    if !inner_type.is_empty() {
      let mapped_inner = pact_type_to_typescript(inner_type);
      return format!("{}[]", mapped_inner);
    }
    return "unknown[]".to_string();
  }

  // Handle table types
  if pact_type.starts_with("table{") && pact_type.ends_with('}') {
    let schema_name = &pact_type[6..pact_type.len() - 1];
    return format!("Record<string, {}>", to_pascal_case(schema_name));
  }

  // Handle module types
  if pact_type.starts_with("module{") && pact_type.ends_with('}') {
    let interfaces = &pact_type[7..pact_type.len() - 1];
    return format!("Record<string, {}>", interfaces);
  }

  // Map basic types
  PACT_TO_TS_TYPE_MAP
    .get(pact_type)
    .unwrap_or(&"unknown")
    .to_string()
}

/// Convert snake_case or kebab-case to PascalCase
fn to_pascal_case(s: &str) -> String {
  let mut result = String::new();
  let mut capitalize_next = true;

  for c in s.chars() {
    if c == '-' || c == '_' {
      capitalize_next = true;
    } else if capitalize_next {
      result.push(c.to_uppercase().next().unwrap_or(c));
      capitalize_next = false;
    } else {
      result.push(c);
    }
  }

  result
}

pub fn convert_to_jsdoc(doc: Option<&str>) -> String {
  match doc {
    Some(text) => {
      if text.trim().is_empty() {
        String::new()
      } else {
        let lines: Vec<String> = text.lines().map(|line| format!(" * {}", line)).collect();
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
    assert_eq!(pact_type_to_typescript("keyset"), "object");
    assert_eq!(pact_type_to_typescript("guard"), "object");
    assert_eq!(pact_type_to_typescript("unknown_type"), "unknown");
  }

  #[test]
  fn test_list_type_mapping() {
    assert_eq!(pact_type_to_typescript("[integer]"), "number[]");
    assert_eq!(pact_type_to_typescript("[string]"), "string[]");
    assert_eq!(pact_type_to_typescript("[object{todo}]"), "Todo[]");
    assert_eq!(pact_type_to_typescript("[]"), "unknown[]");
  }

  #[test]
  fn test_object_type_mapping() {
    assert_eq!(pact_type_to_typescript("object{todo}"), "Todo");
    assert_eq!(pact_type_to_typescript("{todo}"), "Todo");
    assert_eq!(
      pact_type_to_typescript("table{account}"),
      "Record<string, Account>"
    );
  }

  #[test]
  fn test_pascal_case_conversion() {
    assert_eq!(to_pascal_case("todo"), "Todo");
    assert_eq!(to_pascal_case("user-account"), "UserAccount");
    assert_eq!(to_pascal_case("my_schema"), "MySchema");
  }

  #[test]
  fn test_jsdoc_conversion() {
    assert_eq!(convert_to_jsdoc(None), "");
    assert_eq!(
      convert_to_jsdoc(Some("Test function")),
      "/**\n * Test function\n */\n"
    );
    assert_eq!(
      convert_to_jsdoc(Some("Line 1\nLine 2")),
      "/**\n * Line 1\n * Line 2\n */\n"
    );
  }

  #[test]
  fn test_all_mapped_types() {
    // Test all types in the map
    assert_eq!(pact_type_to_typescript("list"), "unknown[]");
    assert_eq!(pact_type_to_typescript("object"), "Record<string, unknown>");
    assert_eq!(pact_type_to_typescript("table"), "Record<string, unknown>");
    assert_eq!(pact_type_to_typescript("value"), "unknown");
    assert_eq!(pact_type_to_typescript("module"), "unknown");
  }

  #[test]
  fn test_nested_list_types() {
    assert_eq!(pact_type_to_typescript("[[string]]"), "string[][]");
    assert_eq!(
      pact_type_to_typescript("[object{user-profile}]"),
      "UserProfile[]"
    );
    assert_eq!(pact_type_to_typescript("[[object{item}]]"), "Item[][]");
  }

  #[test]
  fn test_complex_schema_names() {
    assert_eq!(
      pact_type_to_typescript("object{user-account-data}"),
      "UserAccountData"
    );
    assert_eq!(
      pact_type_to_typescript("{multi_word_schema}"),
      "MultiWordSchema"
    );
    assert_eq!(
      pact_type_to_typescript("table{invoice-line-item}"),
      "Record<string, InvoiceLineItem>"
    );
  }

  #[test]
  fn test_edge_cases() {
    // Empty object type
    assert_eq!(pact_type_to_typescript("object{}"), "");
    assert_eq!(pact_type_to_typescript("{}"), "");

    // Empty table type
    assert_eq!(pact_type_to_typescript("table{}"), "Record<string, >");

    // Invalid formats - should fallback to unknown
    assert_eq!(pact_type_to_typescript("object{"), "unknown");
    assert_eq!(pact_type_to_typescript("}object"), "unknown");
    assert_eq!(pact_type_to_typescript("[string"), "unknown");
    assert_eq!(pact_type_to_typescript("string]"), "unknown");
  }

  #[test]
  fn test_module_type_handling() {
    assert_eq!(
      pact_type_to_typescript("module{interface1}"),
      "Record<string, interface1>"
    );
    assert_eq!(
      pact_type_to_typescript("module{fungible-v2}"),
      "Record<string, fungible-v2>"
    );
  }

  #[test]
  fn test_pascal_case_edge_cases() {
    assert_eq!(to_pascal_case(""), "");
    assert_eq!(to_pascal_case("a"), "A");
    assert_eq!(to_pascal_case("A"), "A");
    assert_eq!(to_pascal_case("already-PascalCase"), "AlreadyPascalCase");
    assert_eq!(to_pascal_case("multiple-dashes-here"), "MultipleDashesHere");
    assert_eq!(
      to_pascal_case("mixed_separators-here"),
      "MixedSeparatorsHere"
    );
    assert_eq!(to_pascal_case("trailing-"), "Trailing");
    assert_eq!(to_pascal_case("-leading"), "Leading");
    assert_eq!(to_pascal_case("--double--dash--"), "DoubleDash");
    assert_eq!(to_pascal_case("__double__underscore__"), "DoubleUnderscore");
  }

  #[test]
  fn test_jsdoc_edge_cases() {
    assert_eq!(convert_to_jsdoc(Some("")), "");

    let multiline = "Line 1\nLine 2\nLine 3";
    let expected = "/**\n * Line 1\n * Line 2\n * Line 3\n */\n";
    assert_eq!(convert_to_jsdoc(Some(multiline)), expected);

    let with_special_chars = "Function with @param and {type} annotations";
    let expected_special = "/**\n * Function with @param and {type} annotations\n */\n";
    assert_eq!(convert_to_jsdoc(Some(with_special_chars)), expected_special);

    let with_whitespace = "  Line with leading/trailing spaces  ";
    let expected_whitespace = "/**\n *   Line with leading/trailing spaces  \n */\n";
    assert_eq!(convert_to_jsdoc(Some(with_whitespace)), expected_whitespace);
  }

  #[test]
  fn test_recursive_type_resolution() {
    // Test deeply nested lists
    assert_eq!(pact_type_to_typescript("[[[string]]]"), "string[][][]");
    assert_eq!(pact_type_to_typescript("[[object{user}]]"), "User[][]");

    // Test complex nested object types
    assert_eq!(pact_type_to_typescript("[object{user-data}]"), "UserData[]");
    assert_eq!(
      pact_type_to_typescript("[[object{nested-item}]]"),
      "NestedItem[][]"
    );
  }

  #[test]
  fn test_type_mapping_consistency() {
    // Ensure consistency across different ways of representing similar types
    assert_eq!(pact_type_to_typescript("object{user}"), "User");
    assert_eq!(pact_type_to_typescript("{user}"), "User");

    // Both should produce arrays
    assert_eq!(pact_type_to_typescript("[object{user}]"), "User[]");
    assert_eq!(pact_type_to_typescript("[{user}]"), "User[]");
  }

  #[test]
  fn test_real_world_pact_types() {
    // Common Pact types from real contracts
    assert_eq!(pact_type_to_typescript("decimal"), "number");
    assert_eq!(pact_type_to_typescript("object{account}"), "Account");
    assert_eq!(pact_type_to_typescript("[object{account}]"), "Account[]");
    assert_eq!(
      pact_type_to_typescript("table{balances}"),
      "Record<string, Balances>"
    );
    assert_eq!(pact_type_to_typescript("keyset"), "object");
    assert_eq!(pact_type_to_typescript("guard"), "object");
    assert_eq!(
      pact_type_to_typescript("module{fungible-v2}"),
      "Record<string, fungible-v2>"
    );
  }

  #[test]
  fn test_case_preservation_in_types() {
    // Test that non-schema parts preserve their case
    assert_eq!(pact_type_to_typescript("object{CamelCase}"), "CamelCase");
    assert_eq!(
      pact_type_to_typescript("table{UPPERCASE}"),
      "Record<string, UPPERCASE>"
    );
    assert_eq!(pact_type_to_typescript("{mixedCASE}"), "MixedCASE");
  }
}
