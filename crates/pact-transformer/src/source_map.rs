use crate::ast::*;
use base64::prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use sourcemap::{SourceMap, SourceMapBuilder};
use std::collections::HashMap;

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceMapOptions {
  /// Whether to generate source maps
  pub generate: Option<bool>,

  /// Whether to inline source maps in the generated files
  pub inline: Option<bool>,

  /// Whether to include original source content in the source map
  pub sources_content: Option<bool>,

  /// File extension for separate source map files
  pub file_extension: Option<String>,

  /// Base URL for source files (for web deployment)
  pub source_root: Option<String>,

  /// Whether to include names mapping for better debugging
  pub include_names: Option<bool>,

  /// Whether to generate declaration maps for TypeScript files
  pub declaration_map: Option<bool>,
}

impl Default for SourceMapOptions {
  fn default() -> Self {
    Self {
      generate: Some(true),
      inline: Some(false),
      sources_content: Some(true),
      file_extension: Some(".map".to_string()),
      source_root: None,
      include_names: Some(true),
      declaration_map: Some(true),
    }
  }
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct SourceLocation {
  pub line: u32,
  pub column: u32,
}

#[derive(Debug, Clone)]
pub struct SourceMapping {
  pub generated_line: u32,
  pub generated_column: u32,
  pub source_file: String,
  pub source_line: u32,
  pub source_column: u32,
  pub name: Option<String>,
}

pub struct SourceMapGenerator {
  options: SourceMapOptions,
  mappings: Vec<SourceMapping>,
  source_contents: HashMap<String, String>,
  generated_line: u32,
  generated_column: u32,
}

impl SourceMapGenerator {
  pub fn new(options: SourceMapOptions) -> Self {
    Self {
      options,
      mappings: Vec::new(),
      source_contents: HashMap::new(),
      generated_line: 1,
      generated_column: 0,
    }
  }

  /// Add source content for a file
  pub fn add_source_content(&mut self, file_path: &str, content: &str) {
    self
      .source_contents
      .insert(file_path.to_string(), content.to_string());
  }

  /// Add a mapping between generated and source positions
  pub fn add_mapping(
    &mut self,
    generated_line: u32,
    generated_column: u32,
    source_file: &str,
    source_line: u32,
    source_column: u32,
    name: Option<&str>,
  ) {
    self.mappings.push(SourceMapping {
      generated_line,
      generated_column,
      source_file: source_file.to_string(),
      source_line,
      source_column,
      name: name.map(std::string::ToString::to_string),
    });
  }

  /// Track current position in generated code
  pub fn advance_generated_position(&mut self, text: &str) {
    for ch in text.chars() {
      if ch == '\n' {
        self.generated_line += 1;
        self.generated_column = 0;
      } else {
        self.generated_column += 1;
      }
    }
  }

  /// Get current generated position
  #[allow(dead_code)]
  pub fn current_position(&self) -> (u32, u32) {
    (self.generated_line, self.generated_column)
  }

  /// Get source map options
  pub fn get_options(&self) -> &SourceMapOptions {
    &self.options
  }

  /// Get source content for a file
  pub fn get_source_content(&self, file_path: &str) -> Option<&String> {
    self.source_contents.get(file_path)
  }

  /// Generate the source map
  pub fn generate(&self, generated_file: &str) -> SourceMap {
    let mut builder = SourceMapBuilder::new(Some(generated_file));

    // Add source files
    for (file_path, content) in &self.source_contents {
      let source_id = builder.add_source(file_path);
      if self.options.sources_content.unwrap_or(true) {
        builder.set_source_contents(source_id, Some(content));
      }
    }

    // Set source root if provided
    if let Some(source_root) = &self.options.source_root {
      builder.set_source_root(Some(source_root.as_str()));
    }

    // Add mappings
    for mapping in &self.mappings {
      let source_id = builder.add_source(&mapping.source_file);
      let name_id = if let Some(name) = &mapping.name {
        if self.options.include_names.unwrap_or(true) {
          Some(builder.add_name(name))
        } else {
          None
        }
      } else {
        None
      };

      builder.add_raw(
        mapping.generated_line.saturating_sub(1),
        mapping.generated_column,
        mapping.source_line.saturating_sub(1),
        mapping.source_column,
        Some(source_id),
        name_id,
        false, // Not a token that should be highlighted differently
      );
    }

    builder.into_sourcemap()
  }

  /// Generate source map as JSON string
  pub fn generate_json(&self, generated_file: &str) -> Result<String, String> {
    let source_map = self.generate(generated_file);
    let mut buf = Vec::new();
    source_map.to_writer(&mut buf).map_err(|e| e.to_string())?;
    String::from_utf8(buf).map_err(|e| e.to_string())
  }

  /// Generate inline source map comment
  pub fn generate_inline_comment(
    &self,
    generated_file: &str,
    _is_typescript: bool,
  ) -> Result<String, String> {
    let json = self.generate_json(generated_file)?;
    let encoded = BASE64_STANDARD.encode(&json);

    let comment_prefix = "//";
    Ok(format!(
      "{comment_prefix}# sourceMappingURL=data:application/json;charset=utf-8;base64,{encoded}"
    ))
  }

  /// Generate external source map reference comment
  pub fn generate_external_comment(map_file_name: &str, _is_typescript: bool) -> String {
    let comment_prefix = "//";
    format!("{comment_prefix}# sourceMappingURL={map_file_name}")
  }

  /// Generate declaration map for TypeScript declarations
  pub fn generate_declaration_map(&self, declaration_file: &str) -> Result<String, String> {
    if !self.options.declaration_map.unwrap_or(false) {
      return Err("Declaration map generation is disabled".to_string());
    }

    // Create a declaration-specific source map
    let mut builder = SourceMapBuilder::new(Some(declaration_file));

    // Add source files
    for (file_path, content) in &self.source_contents {
      let source_id = builder.add_source(file_path);
      if self.options.sources_content.unwrap_or(true) {
        builder.set_source_contents(source_id, Some(content));
      }
    }

    // Set source root if provided
    if let Some(source_root) = &self.options.source_root {
      builder.set_source_root(Some(source_root.as_str()));
    }

    // Add mappings (for declarations, we map type definitions to their source)
    for mapping in &self.mappings {
      let source_id = builder.add_source(&mapping.source_file);
      let name_id = if let Some(name) = &mapping.name {
        if self.options.include_names.unwrap_or(true) {
          Some(builder.add_name(name))
        } else {
          None
        }
      } else {
        None
      };

      builder.add_raw(
        mapping.generated_line.saturating_sub(1),
        mapping.generated_column,
        mapping.source_line.saturating_sub(1),
        mapping.source_column,
        Some(source_id),
        name_id,
        false,
      );
    }

    let source_map = builder.into_sourcemap();
    let mut buf = Vec::new();
    source_map.to_writer(&mut buf).map_err(|e| e.to_string())?;
    String::from_utf8(buf).map_err(|e| e.to_string())
  }

  /// Generate declaration map comment for TypeScript declarations
  #[allow(dead_code)]
  pub fn generate_declaration_map_comment(declaration_map_file: &str) -> String {
    format!("//# sourceMappingURL={declaration_map_file}")
  }
}

/// Parse Pact source to find line/column positions for AST nodes
#[allow(dead_code)]
pub fn analyze_pact_positions(
  source: &str,
  modules: &[PactModule],
) -> HashMap<String, SourceLocation> {
  let mut positions = HashMap::new();
  let lines: Vec<&str> = source.lines().collect();

  for module in modules {
    // Find module position
    if let Some(pos) = find_text_position(&lines, &format!("module {}", module.name)) {
      positions.insert(format!("module:{}", module.name), pos);
    }

    // Find function positions
    for function in &module.functions {
      if let Some(pos) = find_text_position(&lines, &format!("defun {}", function.name)) {
        positions.insert(format!("function:{}:{}", module.name, function.name), pos);
      }
    }

    // Find capability positions
    for capability in &module.capabilities {
      if let Some(pos) = find_text_position(&lines, &format!("defcap {}", capability.name)) {
        positions.insert(
          format!("capability:{}:{}", module.name, capability.name),
          pos,
        );
      }
    }

    // Find schema positions
    for schema in &module.schemas {
      if let Some(pos) = find_text_position(&lines, &format!("defschema {}", schema.name)) {
        positions.insert(format!("schema:{}:{}", module.name, schema.name), pos);
      }
    }

    // Find constant positions
    for constant in &module.constants {
      if let Some(pos) = find_text_position(&lines, &format!("defconst {}", constant.name)) {
        positions.insert(format!("constant:{}:{}", module.name, constant.name), pos);
      }
    }
  }

  positions
}

#[allow(dead_code)]
fn find_text_position(lines: &[&str], search_text: &str) -> Option<SourceLocation> {
  for (line_idx, line) in lines.iter().enumerate() {
    if let Some(col_idx) = line.find(search_text) {
      return Some(SourceLocation {
        line: (line_idx + 1) as u32,
        column: col_idx as u32,
      });
    }
  }
  None
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_source_map_generation() {
    let mut generator = SourceMapGenerator::new(SourceMapOptions::default());
    generator.add_source_content("test.pact", "(module test GOVERNANCE)");

    generator.add_mapping(1, 0, "test.pact", 1, 0, Some("module"));
    generator.add_mapping(2, 0, "test.pact", 1, 8, Some("test"));

    let source_map = generator.generate("test.js");
    assert_eq!(source_map.get_source_count(), 1);
    assert_eq!(source_map.get_source(0).unwrap(), "test.pact");
  }

  #[test]
  fn test_inline_source_map_comment() {
    let mut generator = SourceMapGenerator::new(SourceMapOptions::default());
    generator.add_source_content("test.pact", "(module test GOVERNANCE)");

    let comment = generator.generate_inline_comment("test.js", false).unwrap();
    assert!(comment.starts_with("//# sourceMappingURL=data:application/json"));
    assert!(comment.contains("base64,"));
  }

  #[test]
  fn test_external_source_map_comment() {
    let comment = SourceMapGenerator::generate_external_comment("test.js.map", false);
    assert_eq!(comment, "//# sourceMappingURL=test.js.map");
  }

  #[test]
  fn test_declaration_map_generation() {
    let mut options = SourceMapOptions::default();
    options.declaration_map = Some(true);

    let mut generator = SourceMapGenerator::new(options);
    generator.add_source_content("test.pact", "(module test GOVERNANCE)");

    generator.add_mapping(1, 0, "test.pact", 1, 0, Some("module"));
    generator.add_mapping(2, 0, "test.pact", 1, 8, Some("test"));

    let declaration_map = generator.generate_declaration_map("test.d.ts").unwrap();
    assert!(declaration_map.contains("\"sources\""));
    assert!(declaration_map.contains("test.pact"));

    let comment = SourceMapGenerator::generate_declaration_map_comment("test.d.ts.map");
    assert_eq!(comment, "//# sourceMappingURL=test.d.ts.map");
  }

  #[test]
  fn test_pact_position_analysis() {
    let source = r#"
(module test GOVERNANCE
  (defun hello:string ()
    "Hello world")

  (defschema user
    name:string
    age:integer)

  (defcap ADMIN () true)
)"#;

    let module = PactModule {
      name: "test".to_string(),
      namespace: None,
      governance: "GOVERNANCE".to_string(),
      doc: None,
      functions: vec![PactFunction {
        name: "hello".to_string(),
        doc: Some("Hello world".to_string()),
        parameters: vec![],
        return_type: Some("string".to_string()),
        body: "\"Hello world\"".to_string(),
        is_defun: true,
      }],
      capabilities: vec![PactCapability {
        name: "ADMIN".to_string(),
        doc: None,
        parameters: vec![],
        return_type: None,
        managed: None,
        is_event: false,
      }],
      schemas: vec![PactSchema {
        name: "user".to_string(),
        doc: None,
        fields: vec![
          SchemaField {
            name: "name".to_string(),
            field_type: "string".to_string(),
          },
          SchemaField {
            name: "age".to_string(),
            field_type: "integer".to_string(),
          },
        ],
      }],
      constants: vec![],
      uses: vec![],
      implements: vec![],
    };

    let positions = analyze_pact_positions(source, &[module]);

    assert!(positions.contains_key("module:test"));
    assert!(positions.contains_key("function:test:hello"));
    assert!(positions.contains_key("schema:test:user"));
    assert!(positions.contains_key("capability:test:ADMIN"));
  }
}
