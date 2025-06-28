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
    }
  }
}

#[derive(Debug, Clone)]
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
      name: name.map(|s| s.to_string()),
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
  pub fn current_position(&self) -> (u32, u32) {
    (self.generated_line, self.generated_column)
  }

  /// Generate the source map
  pub fn generate(&self, generated_file: &str) -> Result<SourceMap, String> {
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

    Ok(builder.into_sourcemap())
  }

  /// Generate source map as JSON string
  pub fn generate_json(&self, generated_file: &str) -> Result<String, String> {
    let source_map = self.generate(generated_file)?;
    let mut buf = Vec::new();
    source_map.to_writer(&mut buf).map_err(|e| e.to_string())?;
    String::from_utf8(buf).map_err(|e| e.to_string())
  }

  /// Generate inline source map comment
  pub fn generate_inline_comment(
    &self,
    generated_file: &str,
    is_typescript: bool,
  ) -> Result<String, String> {
    let json = self.generate_json(generated_file)?;
    let encoded = BASE64_STANDARD.encode(&json);

    let comment_prefix = if is_typescript { "//" } else { "//" };
    Ok(format!(
      "{}# sourceMappingURL=data:application/json;charset=utf-8;base64,{}",
      comment_prefix, encoded
    ))
  }

  /// Generate external source map reference comment
  pub fn generate_external_comment(&self, map_file_name: &str, is_typescript: bool) -> String {
    let comment_prefix = if is_typescript { "//" } else { "//" };
    format!("{}# sourceMappingURL={}", comment_prefix, map_file_name)
  }
}

/// Parse Pact source to find line/column positions for AST nodes
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

/// Enhanced code generator that tracks source positions
pub struct SourceAwareCodeGenerator {
  pub source_map_gen: SourceMapGenerator,
  pub source_positions: HashMap<String, SourceLocation>,
  pub source_file_path: String,
}

impl SourceAwareCodeGenerator {
  pub fn new(
    options: SourceMapOptions,
    source_content: &str,
    source_file_path: &str,
    modules: &[PactModule],
  ) -> Self {
    let mut source_map_gen = SourceMapGenerator::new(options);
    source_map_gen.add_source_content(source_file_path, source_content);

    let source_positions = analyze_pact_positions(source_content, modules);

    Self {
      source_map_gen,
      source_positions,
      source_file_path: source_file_path.to_string(),
    }
  }

  /// Generate JavaScript/TypeScript code with source map tracking
  pub fn generate_code_with_sourcemap(
    &mut self,
    modules: &[PactModule],
    generate_types: bool,
  ) -> Result<(String, String, Option<String>), String> {
    let mut js_code = String::new();
    let mut ts_types = String::new();

    // Add import statement and track its position
    let import_line = "// This file was generated by the Pact Toolbox\nimport { execution, continuation } from \"@pact-toolbox/transaction\";\n\n";
    js_code.push_str(import_line);
    self.source_map_gen.advance_generated_position(import_line);

    if generate_types {
      let types_import = "// This file was generated by the Pact Toolbox\nimport { PactTransactionBuilder, PactExecPayload } from \"@pact-toolbox/transaction\";\n\n";
      ts_types.push_str(types_import);
    }

    // Generate code for each module
    for module in modules {
      self.generate_module_code(module, &mut js_code, &mut ts_types, generate_types)?;
    }

    // Generate source map
    let source_map_json = if self.source_map_gen.options.generate.unwrap_or(true) {
      Some(self.source_map_gen.generate_json("generated.js")?)
    } else {
      None
    };

    Ok((js_code, ts_types, source_map_json))
  }

  fn generate_module_code(
    &mut self,
    module: &PactModule,
    js_code: &mut String,
    ts_types: &mut String,
    generate_types: bool,
  ) -> Result<(), String> {
    // Generate schemas first
    for schema in &module.schemas {
      self.generate_schema_code(module, schema, ts_types)?;
    }

    // Generate functions
    for function in &module.functions {
      self.generate_function_code(module, function, js_code, ts_types, generate_types)?;
    }

    Ok(())
  }

  fn generate_schema_code(
    &mut self,
    module: &PactModule,
    schema: &PactSchema,
    ts_types: &mut String,
  ) -> Result<(), String> {
    if !ts_types.is_empty() {
      // Track source position for schema
      let schema_key = format!("schema:{}:{}", module.name, schema.name);
      if let Some(source_pos) = self.source_positions.get(&schema_key) {
        let (gen_line, gen_col) = self.source_map_gen.current_position();
        self.source_map_gen.add_mapping(
          gen_line,
          gen_col,
          &self.source_file_path,
          source_pos.line,
          source_pos.column,
          Some(&schema.name),
        );
      }

      // Generate JSDoc if present
      if let Some(doc) = &schema.doc {
        let doc_comment = format!("/**\n * {}\n */\n", doc);
        ts_types.push_str(&doc_comment);
      }

      // Generate interface
      let pascal_case_name = to_pascal_case(&schema.name);
      let interface_line = format!("export interface {} {{\n", pascal_case_name);
      ts_types.push_str(&interface_line);

      // Generate fields
      for field in &schema.fields {
        let ts_type = pact_type_to_typescript(&field.field_type);
        let camel_case_field = to_camel_case(&field.name);
        let field_line = format!("  {}: {};\n", camel_case_field, ts_type);
        ts_types.push_str(&field_line);
      }

      ts_types.push_str("}\n\n");
    }

    Ok(())
  }

  fn generate_function_code(
    &mut self,
    module: &PactModule,
    function: &PactFunction,
    js_code: &mut String,
    ts_types: &mut String,
    generate_types: bool,
  ) -> Result<(), String> {
    let function_key = format!("function:{}:{}", module.name, function.name);
    let camel_case_name = to_camel_case(&function.name);

    // Track source position for function
    if let Some(source_pos) = self.source_positions.get(&function_key) {
      let (gen_line, gen_col) = self.source_map_gen.current_position();
      self.source_map_gen.add_mapping(
        gen_line,
        gen_col,
        &self.source_file_path,
        source_pos.line,
        source_pos.column,
        Some(&function.name),
      );
    }

    // Generate JSDoc for JavaScript
    if let Some(doc) = &function.doc {
      let doc_comment = format!("/**\n * {}\n */\n", doc);
      js_code.push_str(&doc_comment);
      self.source_map_gen.advance_generated_position(&doc_comment);
    }

    // Generate function parameters
    let params = function
      .parameters
      .iter()
      .map(|p| &p.name)
      .cloned()
      .collect::<Vec<_>>()
      .join(", ");

    // Generate JavaScript function
    let func_signature = format!("export function {}({}) {{\n", camel_case_name, params);
    js_code.push_str(&func_signature);
    self
      .source_map_gen
      .advance_generated_position(&func_signature);

    // Create Pact command string with proper module reference including namespace
    let module_ref = if let Some(namespace) = &module.namespace {
      format!("{}.{}", namespace, module.name)
    } else {
      module.name.to_string()
    };
    let mut pact_cmd = format!("({}.{}", module_ref, function.name);

    // Add parameters with JSON.stringify for proper escaping
    for param in &function.parameters {
      let param_ref = format!(" ${{JSON.stringify({})}}", param.name);
      pact_cmd.push_str(&param_ref);
    }
    pact_cmd.push(')');

    // Use execution for defuns, continuation for defpacts
    let builder = if function.is_defun {
      "execution"
    } else {
      "continuation"
    };
    let return_line = format!("    return {}(`{}`);\n", builder, pact_cmd);
    js_code.push_str(&return_line);
    self.source_map_gen.advance_generated_position(&return_line);

    let func_end = "}\n\n";
    js_code.push_str(func_end);
    self.source_map_gen.advance_generated_position(func_end);

    // Generate TypeScript declaration if requested
    if generate_types {
      if let Some(doc) = &function.doc {
        let doc_comment = format!("/**\n * {}\n */\n", doc);
        ts_types.push_str(&doc_comment);
      }

      // Generate parameter types with camelCase names
      let param_types = if function.parameters.is_empty() {
        String::new()
      } else {
        function
          .parameters
          .iter()
          .map(|p| {
            let ts_type = p
              .parameter_type
              .as_ref()
              .map(|t| pact_type_to_typescript(t))
              .unwrap_or_else(|| "any".to_string());
            let camel_case_param = to_camel_case(&p.name);
            format!("{}: {}", camel_case_param, ts_type)
          })
          .collect::<Vec<_>>()
          .join(", ")
      };

      // Generate return type
      let return_type = function
        .return_type
        .as_ref()
        .map(|t| pact_type_to_typescript(t))
        .unwrap_or_else(|| "unknown".to_string());

      let ts_declaration = format!(
        "export function {}({}): PactTransactionBuilder<PactExecPayload, {}>;\n",
        camel_case_name, param_types, return_type
      );
      ts_types.push_str(&ts_declaration);
    }

    Ok(())
  }
}

// Helper functions (these would be imported from the types module)
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

fn to_camel_case(s: &str) -> String {
  let mut result = String::new();
  let mut capitalize_next = false;

  for (i, c) in s.chars().enumerate() {
    if c == '-' || c == '_' {
      capitalize_next = true;
    } else if i == 0 {
      result.push(c.to_lowercase().next().unwrap_or(c));
    } else if capitalize_next {
      result.push(c.to_uppercase().next().unwrap_or(c));
      capitalize_next = false;
    } else {
      result.push(c);
    }
  }

  result
}

fn pact_type_to_typescript(pact_type: &str) -> String {
  // This is a simplified version - in practice, this would import from the types module
  match pact_type {
    "string" => "string".to_string(),
    "integer" => "number".to_string(),
    "decimal" => "number".to_string(),
    "bool" => "boolean".to_string(),
    "time" => "Date".to_string(),
    "keyset" => "object".to_string(),
    "guard" => "object".to_string(),
    _ => {
      // Handle complex types
      if pact_type.starts_with("object{") && pact_type.ends_with('}') {
        let schema_name = &pact_type[7..pact_type.len() - 1];
        to_pascal_case(schema_name)
      } else if pact_type.starts_with('[') && pact_type.ends_with(']') {
        let inner_type = &pact_type[1..pact_type.len() - 1];
        format!("{}[]", pact_type_to_typescript(inner_type))
      } else {
        "unknown".to_string()
      }
    }
  }
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

    let source_map = generator.generate("test.js").unwrap();
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
    let generator = SourceMapGenerator::new(SourceMapOptions::default());
    let comment = generator.generate_external_comment("test.js.map", false);
    assert_eq!(comment, "//# sourceMappingURL=test.js.map");
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

  #[test]
  fn test_source_aware_code_generation() {
    let source = r#"
(module test GOVERNANCE
  (defun hello:string ()
    "Hello world"))
"#;

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
      capabilities: vec![],
      schemas: vec![],
      constants: vec![],
      uses: vec![],
      implements: vec![],
    };

    let mut generator = SourceAwareCodeGenerator::new(
      SourceMapOptions::default(),
      source,
      "test.pact",
      &[module.clone()],
    );

    let (js_code, ts_types, source_map) = generator
      .generate_code_with_sourcemap(&[module], true)
      .unwrap();

    assert!(js_code.contains("export function hello()"));
    assert!(ts_types.contains("export function hello():"));
    assert!(source_map.is_some());

    let source_map_json = source_map.unwrap();
    assert!(source_map_json.contains("\"sources\":[\"test.pact\"]"));
    assert!(source_map_json.contains("\"sourcesContent\""));
  }
}
