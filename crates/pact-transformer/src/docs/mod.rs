use crate::ast::{PactCapability, PactConstant, PactFunction, PactModule, PactSchema};
use anyhow::Result;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub mod html;
pub mod json;
pub mod markdown;
pub mod playground;

#[cfg(test)]
mod test_demo;

/// Documentation generation options
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocsOptions {
  /// Output format: "html", "markdown", "json", "gitbook"
  pub format: String,

  /// Theme for HTML output
  pub theme: Option<String>,

  /// Include code examples
  pub include_examples: Option<bool>,

  /// Enable interactive examples
  pub interactive_examples: Option<bool>,

  /// Enable API playground
  pub api_playground: Option<bool>,

  /// Custom CSS for HTML output
  pub custom_css: Option<String>,

  /// Custom JavaScript for HTML output
  pub custom_js: Option<String>,

  /// Base URL for links
  pub base_url: Option<String>,

  /// Include search functionality
  pub search_enabled: Option<bool>,

  /// Include table of contents
  pub toc_enabled: Option<bool>,

  /// Group functions by category
  pub group_by_category: Option<bool>,

  /// Include source code snippets
  pub include_source: Option<bool>,

  /// Syntax highlighting theme
  pub syntax_theme: Option<String>,
}

impl Default for DocsOptions {
  fn default() -> Self {
    Self {
      format: "html".to_string(),
      theme: Some("default".to_string()),
      include_examples: Some(true),
      interactive_examples: Some(false),
      api_playground: Some(false),
      custom_css: None,
      custom_js: None,
      base_url: Some("/".to_string()),
      search_enabled: Some(true),
      toc_enabled: Some(true),
      group_by_category: Some(true),
      include_source: Some(true),
      syntax_theme: Some("github".to_string()),
    }
  }
}

/// Documentation generator trait
pub trait DocsGenerator {
  /// Generator name
  fn name(&self) -> &'static str;

  /// Generate documentation for modules
  fn generate(&self, modules: &[PactModule], options: &DocsOptions) -> Result<Documentation>;

  /// Generate index page
  fn generate_index(&self, modules: &[PactModule], options: &DocsOptions) -> Result<String>;

  /// Generate module documentation
  fn generate_module(&self, module: &PactModule, options: &DocsOptions) -> Result<String>;

  /// Generate function documentation
  fn generate_function(
    &self,
    function: &PactFunction,
    module: &PactModule,
    options: &DocsOptions,
  ) -> Result<String>;

  /// Generate capability documentation
  fn generate_capability(
    &self,
    capability: &PactCapability,
    module: &PactModule,
    options: &DocsOptions,
  ) -> Result<String>;

  /// Generate schema documentation
  fn generate_schema(
    &self,
    schema: &PactSchema,
    module: &PactModule,
    options: &DocsOptions,
  ) -> Result<String>;

  /// Generate constant documentation
  fn generate_constant(
    &self,
    constant: &PactConstant,
    module: &PactModule,
    options: &DocsOptions,
  ) -> Result<String>;
}

/// Generated documentation
#[derive(Debug, Clone)]
pub struct Documentation {
  /// Main documentation content
  pub content: String,

  /// Additional files (CSS, JS, images)
  pub assets: HashMap<String, Vec<u8>>,

  /// Table of contents
  pub toc: Option<TableOfContents>,

  /// Search index (for client-side search)
  pub search_index: Option<SearchIndex>,

  /// Metadata
  pub metadata: DocumentationMetadata,
}

/// Table of contents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableOfContents {
  pub sections: Vec<TocSection>,
}

/// TOC section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TocSection {
  pub title: String,
  pub id: String,
  pub level: u32,
  pub children: Vec<TocSection>,
}

/// Search index for client-side search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchIndex {
  pub documents: Vec<SearchDocument>,
  pub index: serde_json::Value, // Lunr.js or similar index
}

/// Search document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchDocument {
  pub id: String,
  pub title: String,
  pub content: String,
  pub url: String,
  pub category: String,
}

/// Documentation metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationMetadata {
  pub title: String,
  pub description: Option<String>,
  pub version: Option<String>,
  pub generated_at: String,
  pub generator: String,
  pub total_modules: usize,
  pub total_functions: usize,
  pub total_capabilities: usize,
  pub total_schemas: usize,
  pub total_constants: usize,
}

/// Documentation factory
pub struct DocsGeneratorFactory;

impl DocsGeneratorFactory {
  /// Create a documentation generator based on format
  pub fn create(format: &str) -> Result<Box<dyn DocsGenerator>> {
    match format {
      "html" => Ok(Box::new(html::HtmlGenerator::new())),
      "markdown" => Ok(Box::new(markdown::MarkdownGenerator::new())),
      "json" => Ok(Box::new(json::JsonGenerator::new())),
      _ => Err(anyhow::anyhow!(
        "Unsupported documentation format: {}",
        format
      )),
    }
  }

  /// Get supported formats
  pub fn supported_formats() -> Vec<&'static str> {
    vec!["html", "markdown", "json"]
  }
}

/// Common documentation utilities
pub mod utils {
  use super::*;
  use crate::ast::PactParameter;

  /// Generate function signature
  pub fn generate_signature(function: &PactFunction) -> String {
    let params = function
      .parameters
      .iter()
      .map(|p| format_parameter(p))
      .collect::<Vec<_>>()
      .join(", ");

    let return_type = function.return_type.as_deref().unwrap_or("void");

    format!("{}({}):{}", function.name, params, return_type)
  }

  /// Format parameter
  pub fn format_parameter(param: &PactParameter) -> String {
    let param_type = param.parameter_type.as_deref().unwrap_or("any");

    format!("{}:{}", param.name, param_type)
  }

  /// Extract categories from documentation
  pub fn extract_categories(modules: &[PactModule]) -> Vec<String> {
    let mut categories = std::collections::HashSet::new();

    for module in modules {
      // Extract from module doc
      if let Some(doc) = &module.doc {
        if let Some(category) = extract_tag(doc, "@category") {
          categories.insert(category);
        }
      }

      // Extract from functions
      for function in &module.functions {
        if let Some(doc) = &function.doc {
          if let Some(category) = extract_tag(doc, "@category") {
            categories.insert(category);
          }
        }
      }
    }

    let mut result: Vec<_> = categories.into_iter().collect();
    result.sort();
    result
  }

  /// Extract tag value from documentation
  pub fn extract_tag(doc: &str, tag: &str) -> Option<String> {
    doc
      .lines()
      .find(|line| line.trim().starts_with(tag))
      .and_then(|line| line.trim().strip_prefix(tag).map(|s| s.trim().to_string()))
  }

  /// Extract examples from documentation
  pub fn extract_examples(doc: &str) -> Vec<String> {
    let mut examples = Vec::new();
    let mut in_example = false;
    let mut current_example = String::new();

    for line in doc.lines() {
      if line.trim().starts_with("@example") {
        if in_example && !current_example.is_empty() {
          examples.push(current_example.trim().to_string());
          current_example.clear();
        }
        in_example = true;
      } else if in_example && line.trim().starts_with("@") {
        if !current_example.is_empty() {
          examples.push(current_example.trim().to_string());
          current_example.clear();
        }
        in_example = false;
      } else if in_example {
        current_example.push_str(line);
        current_example.push('\n');
      }
    }

    if in_example && !current_example.is_empty() {
      examples.push(current_example.trim().to_string());
    }

    examples
  }

  /// Clean documentation text
  pub fn clean_doc(doc: &str) -> String {
    doc
      .lines()
      .filter(|line| !line.trim().starts_with("@"))
      .map(|line| line.trim())
      .filter(|line| !line.is_empty())
      .collect::<Vec<_>>()
      .join(" ")
  }

  /// Generate anchor ID from text
  pub fn generate_id(text: &str) -> String {
    text
      .to_lowercase()
      .chars()
      .map(|c| if c.is_alphanumeric() { c } else { '-' })
      .collect::<String>()
      .trim_matches('-')
      .to_string()
  }

  /// Format code block
  pub fn format_code_block(code: &str, language: &str) -> String {
    format!("```{}\n{}\n```", language, code)
  }

  /// Generate metadata for documentation
  pub fn generate_metadata(modules: &[PactModule], generator: &str) -> DocumentationMetadata {
    let total_functions: usize = modules.iter().map(|m| m.functions.len()).sum();

    let total_capabilities: usize = modules.iter().map(|m| m.capabilities.len()).sum();

    let total_schemas: usize = modules.iter().map(|m| m.schemas.len()).sum();

    let total_constants: usize = modules.iter().map(|m| m.constants.len()).sum();

    DocumentationMetadata {
      title: "Pact Contract Documentation".to_string(),
      description: None,
      version: None,
      generated_at: chrono::Utc::now().to_rfc3339(),
      generator: generator.to_string(),
      total_modules: modules.len(),
      total_functions,
      total_capabilities,
      total_schemas,
      total_constants,
    }
  }
}

/// NAPI-exposed function to generate documentation
#[napi]
pub async fn generate_documentation(
  modules: Vec<PactModule>,
  options: DocsOptions,
) -> Result<DocumentationResult, napi::Error> {
  tokio::task::spawn_blocking(move || {
    let generator = DocsGeneratorFactory::create(&options.format)
      .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let docs = generator
      .generate(&modules, &options)
      .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    Ok(DocumentationResult {
      content: docs.content,
      assets: docs
        .assets
        .into_iter()
        .map(|(k, v)| DocumentationAsset {
          path: k,
          content: v,
        })
        .collect(),
      toc: docs
        .toc
        .map(|t| serde_json::to_string(&t).unwrap_or_default()),
      search_index: docs
        .search_index
        .map(|s| serde_json::to_string(&s).unwrap_or_default()),
      metadata: DocumentationMetadataResult {
        title: docs.metadata.title,
        description: docs.metadata.description,
        version: docs.metadata.version,
        generated_at: docs.metadata.generated_at,
        generator: docs.metadata.generator,
        total_modules: docs.metadata.total_modules as u32,
        total_functions: docs.metadata.total_functions as u32,
        total_capabilities: docs.metadata.total_capabilities as u32,
        total_schemas: docs.metadata.total_schemas as u32,
        total_constants: docs.metadata.total_constants as u32,
      },
    })
  })
  .await
  .map_err(|e| napi::Error::from_reason(e.to_string()))?
}

/// Documentation result for NAPI
#[napi(object)]
pub struct DocumentationResult {
  pub content: String,
  pub assets: Vec<DocumentationAsset>,
  pub toc: Option<String>,
  pub search_index: Option<String>,
  pub metadata: DocumentationMetadataResult,
}

/// Documentation asset for NAPI
#[napi(object)]
pub struct DocumentationAsset {
  pub path: String,
  pub content: Vec<u8>,
}

/// Documentation metadata for NAPI
#[napi(object)]
pub struct DocumentationMetadataResult {
  pub title: String,
  pub description: Option<String>,
  pub version: Option<String>,
  pub generated_at: String,
  pub generator: String,
  pub total_modules: u32,
  pub total_functions: u32,
  pub total_capabilities: u32,
  pub total_schemas: u32,
  pub total_constants: u32,
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_docs_factory() {
    assert!(DocsGeneratorFactory::create("html").is_ok());
    assert!(DocsGeneratorFactory::create("markdown").is_ok());
    assert!(DocsGeneratorFactory::create("json").is_ok());
    assert!(DocsGeneratorFactory::create("unknown").is_err());
  }

  #[test]
  fn test_utils() {
    let doc = "@doc This is a test\n@category Finance\n@example\nlet x = 1;";

    assert_eq!(
      utils::extract_tag(doc, "@category"),
      Some("Finance".to_string())
    );
    assert_eq!(utils::extract_examples(doc).len(), 1);
    assert_eq!(utils::clean_doc(doc), "This is a test");
    assert_eq!(utils::generate_id("Hello World!"), "hello-world");
  }
}
