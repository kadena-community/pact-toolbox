#[cfg(test)]
mod tests {
  use super::super::*;
  use crate::ast::PactModule;
  use crate::PactTransformer;

  #[test]
  fn test_documentation_generation() {
    let sample_contract = r#"
        (module test-module GOVERNANCE
          @doc "Test module for documentation"
          
          (defcap GOVERNANCE () true)
          
          (defschema user-schema
            @doc "User schema"
            name: string
            age: integer)
          
          (defun add:integer (a:integer b:integer)
            @doc "Add two numbers
            @param a First number
            @param b Second number
            @return Sum of a and b"
            (+ a b))
        )
        "#;

    let mut transformer = PactTransformer::new();
    let (modules, errors) = transformer.parse(sample_contract);
    assert!(errors.is_empty());
    assert_eq!(modules.len(), 1);

    // Test HTML generation
    let html_gen = html::HtmlGenerator::new();
    let options = DocsOptions::default();
    let html_docs = html_gen.generate(&modules, &options).unwrap();
    assert!(!html_docs.content.is_empty());
    assert!(html_docs.content.contains("test-module"));
    assert!(html_docs.content.contains("Add two numbers"));

    // Test Markdown generation
    let md_gen = markdown::MarkdownGenerator::new();
    let md_docs = md_gen.generate(&modules, &options).unwrap();
    assert!(!md_docs.content.is_empty());
    assert!(md_docs.content.contains("test-module"));
    assert!(md_docs.content.contains("Functions"));

    // Test JSON generation
    let json_gen = json::JsonGenerator::new();
    let json_docs = json_gen.generate(&modules, &options).unwrap();
    assert!(!json_docs.content.is_empty());
    let parsed: serde_json::Value = serde_json::from_str(&json_docs.content).unwrap();
    assert!(parsed.is_object());
    assert!(parsed["modules"].is_array());

    println!("✅ All documentation generators working correctly!");
  }

  #[test]
  fn test_playground_generation() {
    use playground::{generate_playground_html, PlaygroundConfig};

    let config = PlaygroundConfig::default();
    let html = generate_playground_html(&config);

    assert!(html.contains("pact-playground"));
    assert!(html.contains("btn-run"));
    assert!(html.contains("pact-editor"));
  }

  #[test]
  fn test_search_index_generation() {
    let modules = vec![PactModule {
      name: "test".to_string(),
      namespace: None,
      governance: "GOV".to_string(),
      doc: Some("Test module".to_string()),
      functions: vec![],
      capabilities: vec![],
      schemas: vec![],
      constants: vec![],
      uses: vec![],
      implements: vec![],
    }];

    let html_gen = html::HtmlGenerator::new();
    let options = DocsOptions {
      search_enabled: Some(true),
      ..Default::default()
    };

    let docs = html_gen.generate(&modules, &options).unwrap();
    assert!(docs.search_index.is_some());

    let search_index = docs.search_index.unwrap();
    assert!(!search_index.documents.is_empty());
    assert_eq!(search_index.documents[0].title, "test");
  }
}
