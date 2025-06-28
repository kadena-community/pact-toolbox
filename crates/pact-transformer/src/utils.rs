use smallvec::SmallVec;

#[allow(dead_code)]
pub fn split_module_reference(reference: &str) -> (String, Option<String>) {
  let parts: SmallVec<[&str; 2]> = reference.split('.').collect();

  match parts.len() {
    1 => (parts[0].to_string(), None),
    2 => (parts[0].to_string(), Some(parts[1].to_string())),
    _ => (reference.to_string(), None),
  }
}

#[allow(dead_code)]
pub fn is_builtin_function(name: &str) -> bool {
  matches!(
    name,
    "+"
      | "-"
      | "*"
      | "/"
      | "^"
      | "="
      | "!="
      | "<"
      | ">"
      | "<="
      | ">="
      | "and"
      | "or"
      | "not"
      | "if"
      | "enforce"
      | "enforce-one"
      | "format"
      | "length"
      | "take"
      | "drop"
      | "at"
      | "make-list"
      | "map"
      | "fold"
      | "filter"
      | "hash"
      | "read"
      | "write"
      | "keys"
      | "insert"
      | "update"
      | "with-read"
      | "with-default-read"
      | "bind"
      | "resume"
      | "yield"
      | "create-table"
      | "describe-table"
      | "read-keyset"
      | "define-keyset"
      | "enforce-keyset"
      | "keys-all"
      | "keys-any"
      | "keys-2"
      | "read-decimal"
      | "read-integer"
      | "read-string"
  )
}

#[allow(dead_code)]
pub fn clean_string_literal(s: &str) -> String {
  if s.starts_with('"') && s.ends_with('"') {
    s[1..s.len() - 1].to_string()
  } else {
    s.to_string()
  }
}

#[allow(dead_code)]
pub fn escape_js_string(s: &str) -> String {
  s.replace('\\', "\\\\")
    .replace('"', "\\\"")
    .replace('\n', "\\n")
    .replace('\r', "\\r")
    .replace('\t', "\\t")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_split_module_reference() {
    assert_eq!(split_module_reference("coin"), ("coin".to_string(), None));
    assert_eq!(
      split_module_reference("coin.transfer"),
      ("coin".to_string(), Some("transfer".to_string()))
    );
  }

  #[test]
  fn test_is_builtin_function() {
    assert!(is_builtin_function("+"));
    assert!(is_builtin_function("enforce"));
    assert!(is_builtin_function("read"));
    assert!(!is_builtin_function("custom-function"));
  }

  #[test]
  fn test_clean_string_literal() {
    assert_eq!(clean_string_literal("\"hello\""), "hello");
    assert_eq!(clean_string_literal("hello"), "hello");
  }

  #[test]
  fn test_escape_js_string() {
    assert_eq!(escape_js_string("hello\nworld"), "hello\\nworld");
    assert_eq!(escape_js_string("path\\to\\file"), "path\\\\to\\\\file");
    assert_eq!(escape_js_string("say \"hello\""), "say \\\"hello\\\"");
  }
}
