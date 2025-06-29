use crate::code_generator::CodeGenerator;
use crate::parser::Parser;
use std::fs;

#[test]
#[allow(clippy::uninlined_format_args)]
fn test_todo_pact_generation() {
  // Read the test_todo.pact file
  let source = fs::read_to_string("test_todo.pact").expect("Failed to read test_todo.pact");

  // Parse the module
  let mut parser = Parser::new();
  let (modules, errors) = parser.parse(&source);

  // Should parse without errors
  assert!(errors.is_empty(), "Parse errors: {errors:?}");
  assert_eq!(modules.len(), 1, "Should have exactly one module");

  let module = &modules[0];
  assert_eq!(module.name, "todos");
  assert_eq!(module.namespace, Some("free".to_string()));

  // Check that we have the expected functions
  let expected_functions = [
    "create-todo",
    "toggle-todo",
    "update-todo",
    "delete-todo",
    "get-todo",
    "get-todos",
  ];
  assert_eq!(module.functions.len(), expected_functions.len());

  for (i, expected_name) in expected_functions.iter().enumerate() {
    assert_eq!(module.functions[i].name, *expected_name);
  }

  // Check schema
  assert_eq!(module.schemas.len(), 1);
  assert_eq!(module.schemas[0].name, "todo");

  // Generate JavaScript
  let mut js_generator = CodeGenerator::new(false);
  let (js_code, _, _, _) = js_generator.generate(&modules);

  println!("\n=== Generated JavaScript ===");
  println!("{js_code}");

  // Verify JavaScript contains expected patterns
  assert!(js_code.contains("import { execution, continuation }"));
  assert!(js_code.contains("export function createTodo(id, title) {"));
  assert!(js_code.contains(
    "return execution(`(free.todos.create-todo ${JSON.stringify(id)} ${JSON.stringify(title)})`)"
  ));
  assert!(js_code.contains("export function getTodos() {"));
  assert!(js_code.contains("return execution(`(free.todos.get-todos)`)"));

  // Generate TypeScript
  let mut ts_generator = CodeGenerator::new(true);
  let (_, ts_types, _, _) = ts_generator.generate(&modules);

  println!("\n=== Generated TypeScript ===");
  println!("{ts_types}");

  // Verify TypeScript contains expected patterns
  assert!(ts_types.contains("import { PactTransactionBuilder, PactExecPayload }"));
  assert!(ts_types.contains("export interface Todo {"));
  assert!(ts_types.contains("id: string;"));
  assert!(ts_types.contains("title: string;"));
  assert!(ts_types.contains("completed: boolean;"));
  assert!(ts_types.contains("deleted: boolean;"));
  assert!(ts_types.contains("export function createTodo(id: string, title: string): PactTransactionBuilder<PactExecPayload, string>;"));
  assert!(ts_types
    .contains("export function getTodos(): PactTransactionBuilder<PactExecPayload, Todo[]>;"));
}

#[tokio::test]
#[allow(clippy::uninlined_format_args)]
async fn test_source_map_generation() {
  use crate::api::PactTransformer;
  use crate::TransformOptions;

  // Read the test_todo.pact file
  let source = std::fs::read_to_string("test_todo.pact").expect("Failed to read test_todo.pact");

  let transformer = PactTransformer::new();

  // Test with source maps enabled
  let result = transformer
    .transform_file(
      source,
      "test_todo.pact".to_string(),
      Some(TransformOptions {
        generate_types: Some(true),
        module_name: None,
        source_maps: Some(true),
        source_file_path: Some("test_todo.pact".to_string()),
        declaration_maps: Some(true),
      }),
    )
    .await
    .expect("Transform failed");

  println!("\n=== Generated with Source Maps ===");
  println!("JavaScript: {} chars", result.javascript.len());
  println!(
    "TypeScript: {} chars",
    result
      .typescript
      .as_ref()
      .map_or(0, std::string::String::len)
  );
  println!(
    "Source Map: {:?}",
    result.source_map.as_ref().map(std::string::String::len)
  );
  println!(
    "Declaration Map: {:?}",
    result
      .declaration_map
      .as_ref()
      .map(std::string::String::len)
  );

  // Verify we got a source map and declaration map
  assert!(
    result.source_map.is_some(),
    "Source map should be generated"
  );
  assert!(
    result.declaration_map.is_some(),
    "Declaration map should be generated"
  );

  // Verify source map and declaration map are valid JSON
  let source_map_json = result.source_map.unwrap();
  let _parsed: serde_json::Value =
    serde_json::from_str(&source_map_json).expect("Source map should be valid JSON");

  println!(
    "✅ Source map is valid JSON: {} chars",
    source_map_json.len()
  );

  let declaration_map_json = result.declaration_map.unwrap();
  let _parsed: serde_json::Value =
    serde_json::from_str(&declaration_map_json).expect("Declaration map should be valid JSON");

  println!(
    "✅ Declaration map is valid JSON: {} chars",
    declaration_map_json.len()
  );
}
