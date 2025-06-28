use super::{utils, DocsGenerator, DocsOptions, Documentation, TableOfContents, TocSection};
use crate::ast::{PactCapability, PactConstant, PactFunction, PactModule, PactSchema};
use anyhow::Result;
use std::collections::HashMap;
use std::fmt::Write;

/// Markdown documentation generator
pub struct MarkdownGenerator;

impl MarkdownGenerator {
  pub fn new() -> Self {
    Self
  }

  fn generate_toc_markdown(&self, toc: &TableOfContents) -> String {
    let mut md = String::new();

    writeln!(&mut md, "## Table of Contents\n").unwrap();

    for section in &toc.sections {
      self.write_toc_section(&mut md, section, 0);
    }

    writeln!(&mut md).unwrap();
    md
  }

  fn write_toc_section(&self, md: &mut String, section: &TocSection, indent: usize) {
    let indent_str = "  ".repeat(indent);
    writeln!(md, "{}- [{}](#{})", indent_str, section.title, section.id).unwrap();

    for child in &section.children {
      self.write_toc_section(md, child, indent + 1);
    }
  }
}

impl DocsGenerator for MarkdownGenerator {
  fn name(&self) -> &'static str {
    "markdown"
  }

  fn generate(&self, modules: &[PactModule], options: &DocsOptions) -> Result<Documentation> {
    let content = self.generate_index(modules, options)?;
    let toc = self.generate_toc(modules)?;
    let metadata = utils::generate_metadata(modules, self.name());

    Ok(Documentation {
      content,
      assets: HashMap::new(),
      toc: Some(toc),
      search_index: None,
      metadata,
    })
  }

  fn generate_index(&self, modules: &[PactModule], options: &DocsOptions) -> Result<String> {
    let mut md = String::new();

    // Title and metadata
    writeln!(&mut md, "# Pact Contract Documentation\n")?;
    writeln!(
      &mut md,
      "*Generated at: {}*\n",
      chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    )?;

    // Generate TOC if enabled
    if options.toc_enabled.unwrap_or(true) {
      let toc = self.generate_toc(modules)?;
      md.push_str(&self.generate_toc_markdown(&toc));
    }

    // Overview section
    writeln!(&mut md, "## Overview\n")?;
    writeln!(&mut md, "| Metric | Count |")?;
    writeln!(&mut md, "|--------|-------|")?;
    writeln!(&mut md, "| Modules | {} |", modules.len())?;

    let total_functions: usize = modules.iter().map(|m| m.functions.len()).sum();
    writeln!(&mut md, "| Functions | {} |", total_functions)?;

    let total_capabilities: usize = modules.iter().map(|m| m.capabilities.len()).sum();
    writeln!(&mut md, "| Capabilities | {} |", total_capabilities)?;

    let total_schemas: usize = modules.iter().map(|m| m.schemas.len()).sum();
    writeln!(&mut md, "| Schemas | {} |", total_schemas)?;

    let total_constants: usize = modules.iter().map(|m| m.constants.len()).sum();
    writeln!(&mut md, "| Constants | {} |\n", total_constants)?;

    // Generate documentation for each module
    writeln!(&mut md, "---\n")?;

    for module in modules {
      writeln!(&mut md, "{}", self.generate_module(module, options)?)?;
      writeln!(&mut md, "---\n")?;
    }

    Ok(md)
  }

  fn generate_module(&self, module: &PactModule, options: &DocsOptions) -> Result<String> {
    let mut md = String::new();
    let module_id = utils::generate_id(&module.name);

    // Module header
    writeln!(
      &mut md,
      "## Module: {} {{#{}}}\n",
      module.name,
      format!("module-{}", module_id)
    )?;

    // Module documentation
    if let Some(doc) = &module.doc {
      writeln!(&mut md, "{}\n", utils::clean_doc(doc))?;
    }

    // Module metadata
    writeln!(&mut md, "**Governance:** `{}`", module.governance)?;
    if let Some(ns) = &module.namespace {
      writeln!(&mut md, "  \n**Namespace:** `{}`", ns)?;
    }
    writeln!(&mut md, "\n")?;

    // Functions section
    if !module.functions.is_empty() {
      writeln!(&mut md, "### Functions\n")?;
      for function in &module.functions {
        writeln!(
          &mut md,
          "{}",
          self.generate_function(function, module, options)?
        )?;
      }
    }

    // Capabilities section
    if !module.capabilities.is_empty() {
      writeln!(&mut md, "### Capabilities\n")?;
      for capability in &module.capabilities {
        writeln!(
          &mut md,
          "{}",
          self.generate_capability(capability, module, options)?
        )?;
      }
    }

    // Schemas section
    if !module.schemas.is_empty() {
      writeln!(&mut md, "### Schemas\n")?;
      for schema in &module.schemas {
        writeln!(
          &mut md,
          "{}",
          self.generate_schema(schema, module, options)?
        )?;
      }
    }

    // Constants section
    if !module.constants.is_empty() {
      writeln!(&mut md, "### Constants\n")?;
      for constant in &module.constants {
        writeln!(
          &mut md,
          "{}",
          self.generate_constant(constant, module, options)?
        )?;
      }
    }

    Ok(md)
  }

  fn generate_function(
    &self,
    function: &PactFunction,
    module: &PactModule,
    options: &DocsOptions,
  ) -> Result<String> {
    let mut md = String::new();
    let function_id = utils::generate_id(&format!("{}-{}", module.name, function.name));

    // Function header
    writeln!(
      &mut md,
      "#### `{}` {{#{}}}\n",
      function.name,
      format!("function-{}", function_id)
    )?;

    // Function signature
    writeln!(&mut md, "```pact")?;
    writeln!(&mut md, "{}", utils::generate_signature(function))?;
    writeln!(&mut md, "```\n")?;

    // Function documentation
    if let Some(doc) = &function.doc {
      writeln!(&mut md, "{}\n", utils::clean_doc(doc))?;

      // Extract and display examples
      let examples = utils::extract_examples(doc);
      if !examples.is_empty() && options.include_examples.unwrap_or(true) {
        writeln!(&mut md, "**Examples:**\n")?;
        for example in examples {
          writeln!(&mut md, "```pact")?;
          writeln!(&mut md, "{}", example.trim())?;
          writeln!(&mut md, "```\n")?;
        }
      }
    }

    // Parameters table
    if !function.parameters.is_empty() {
      writeln!(&mut md, "**Parameters:**\n")?;
      writeln!(&mut md, "| Name | Type | Description |")?;
      writeln!(&mut md, "|------|------|-------------|")?;

      for param in &function.parameters {
        let param_doc = if let Some(doc) = &function.doc {
          utils::extract_tag(doc, &format!("@param {}", param.name)).unwrap_or_default()
        } else {
          String::new()
        };

        writeln!(
          &mut md,
          "| `{}` | `{}` | {} |",
          param.name,
          param.parameter_type.as_deref().unwrap_or("any"),
          param_doc
        )?;
      }
      writeln!(&mut md)?;
    }

    // Return type
    if let Some(return_type) = &function.return_type {
      write!(&mut md, "**Returns:** `{}`", return_type)?;

      if let Some(doc) = &function.doc {
        if let Some(return_doc) = utils::extract_tag(doc, "@return") {
          write!(&mut md, " - {}", return_doc)?;
        }
      }
      writeln!(&mut md, "\n")?;
    }

    Ok(md)
  }

  fn generate_capability(
    &self,
    capability: &PactCapability,
    module: &PactModule,
    _options: &DocsOptions,
  ) -> Result<String> {
    let mut md = String::new();
    let cap_id = utils::generate_id(&format!("{}-{}", module.name, capability.name));

    // Capability header
    write!(&mut md, "#### `{}` ", capability.name)?;
    if capability.is_event {
      write!(&mut md, "*(event)* ")?;
    }
    writeln!(&mut md, "{{#{}}}\n", format!("capability-{}", cap_id))?;

    // Capability documentation
    if let Some(doc) = &capability.doc {
      writeln!(&mut md, "{}\n", utils::clean_doc(doc))?;
    }

    // Parameters
    if !capability.parameters.is_empty() {
      writeln!(&mut md, "**Parameters:**\n")?;
      writeln!(&mut md, "| Name | Type |")?;
      writeln!(&mut md, "|------|------|")?;

      for param in &capability.parameters {
        writeln!(
          &mut md,
          "| `{}` | `{}` |",
          param.name,
          param.parameter_type.as_deref().unwrap_or("any")
        )?;
      }
      writeln!(&mut md)?;
    }

    // Managed info
    if let Some(managed) = &capability.managed {
      writeln!(&mut md, "**Managed:** Parameter `{}`", managed.parameter)?;
      if let Some(mgr) = &managed.manager_function {
        writeln!(&mut md, " (Manager function: `{}`)", mgr)?;
      }
      writeln!(&mut md)?;
    }

    Ok(md)
  }

  fn generate_schema(
    &self,
    schema: &PactSchema,
    module: &PactModule,
    _options: &DocsOptions,
  ) -> Result<String> {
    let mut md = String::new();
    let schema_id = utils::generate_id(&format!("{}-{}", module.name, schema.name));

    // Schema header
    writeln!(
      &mut md,
      "#### `{}` {{#{}}}\n",
      schema.name,
      format!("schema-{}", schema_id)
    )?;

    // Schema documentation
    if let Some(doc) = &schema.doc {
      writeln!(&mut md, "{}\n", utils::clean_doc(doc))?;
    }

    // Fields table
    writeln!(&mut md, "**Fields:**\n")?;
    writeln!(&mut md, "| Field | Type |")?;
    writeln!(&mut md, "|-------|------|")?;

    for field in &schema.fields {
      writeln!(&mut md, "| `{}` | `{}` |", field.name, field.field_type)?;
    }
    writeln!(&mut md)?;

    Ok(md)
  }

  fn generate_constant(
    &self,
    constant: &PactConstant,
    module: &PactModule,
    _options: &DocsOptions,
  ) -> Result<String> {
    let mut md = String::new();
    let const_id = utils::generate_id(&format!("{}-{}", module.name, constant.name));

    // Constant header
    writeln!(
      &mut md,
      "#### `{}` {{#{}}}\n",
      constant.name,
      format!("constant-{}", const_id)
    )?;

    // Constant value
    writeln!(&mut md, "```pact")?;
    writeln!(
      &mut md,
      "{}: {} = {}",
      constant.name,
      constant.constant_type.as_deref().unwrap_or("any"),
      constant.value
    )?;
    writeln!(&mut md, "```\n")?;

    // Documentation
    if let Some(doc) = &constant.doc {
      writeln!(&mut md, "{}\n", utils::clean_doc(doc))?;
    }

    Ok(md)
  }
}

impl MarkdownGenerator {
  fn generate_toc(&self, modules: &[PactModule]) -> Result<TableOfContents> {
    let mut sections = Vec::new();

    // Overview section
    sections.push(TocSection {
      title: "Overview".to_string(),
      id: "overview".to_string(),
      level: 1,
      children: Vec::new(),
    });

    // Module sections
    for module in modules {
      let module_id = utils::generate_id(&module.name);
      let mut module_section = TocSection {
        title: format!("Module: {}", module.name),
        id: format!("module-{}", module_id),
        level: 1,
        children: Vec::new(),
      };

      // Functions subsection
      if !module.functions.is_empty() {
        let mut functions_section = TocSection {
          title: "Functions".to_string(),
          id: format!("functions-{}", module_id),
          level: 2,
          children: Vec::new(),
        };

        for function in &module.functions {
          functions_section.children.push(TocSection {
            title: function.name.clone(),
            id: format!(
              "function-{}-{}",
              module_id,
              utils::generate_id(&function.name)
            ),
            level: 3,
            children: Vec::new(),
          });
        }

        module_section.children.push(functions_section);
      }

      // Capabilities subsection
      if !module.capabilities.is_empty() {
        let mut caps_section = TocSection {
          title: "Capabilities".to_string(),
          id: format!("capabilities-{}", module_id),
          level: 2,
          children: Vec::new(),
        };

        for capability in &module.capabilities {
          caps_section.children.push(TocSection {
            title: capability.name.clone(),
            id: format!(
              "capability-{}-{}",
              module_id,
              utils::generate_id(&capability.name)
            ),
            level: 3,
            children: Vec::new(),
          });
        }

        module_section.children.push(caps_section);
      }

      // Schemas subsection
      if !module.schemas.is_empty() {
        let mut schemas_section = TocSection {
          title: "Schemas".to_string(),
          id: format!("schemas-{}", module_id),
          level: 2,
          children: Vec::new(),
        };

        for schema in &module.schemas {
          schemas_section.children.push(TocSection {
            title: schema.name.clone(),
            id: format!("schema-{}-{}", module_id, utils::generate_id(&schema.name)),
            level: 3,
            children: Vec::new(),
          });
        }

        module_section.children.push(schemas_section);
      }

      // Constants subsection
      if !module.constants.is_empty() {
        let mut consts_section = TocSection {
          title: "Constants".to_string(),
          id: format!("constants-{}", module_id),
          level: 2,
          children: Vec::new(),
        };

        for constant in &module.constants {
          consts_section.children.push(TocSection {
            title: constant.name.clone(),
            id: format!(
              "constant-{}-{}",
              module_id,
              utils::generate_id(&constant.name)
            ),
            level: 3,
            children: Vec::new(),
          });
        }

        module_section.children.push(consts_section);
      }

      sections.push(module_section);
    }

    Ok(TableOfContents { sections })
  }
}

impl Default for MarkdownGenerator {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::ast::{PactFunction, PactParameter};

  #[test]
  fn test_markdown_generator() {
    let generator = MarkdownGenerator::new();
    assert_eq!(generator.name(), "markdown");
  }

  #[test]
  fn test_markdown_function() {
    let function = PactFunction {
            name: "transfer".to_string(),
            doc: Some("Transfer tokens between accounts\n@param from Source account\n@param to Destination account\n@param amount Amount to transfer\n@return Transaction ID".to_string()),
            parameters: vec![
                PactParameter {
                    name: "from".to_string(),
                    parameter_type: Some("string".to_string()),
                },
                PactParameter {
                    name: "to".to_string(),
                    parameter_type: Some("string".to_string()),
                },
                PactParameter {
                    name: "amount".to_string(),
                    parameter_type: Some("decimal".to_string()),
                },
            ],
            return_type: Some("string".to_string()),
            body: String::new(),
            is_defun: true,
        };

    let module = PactModule {
      name: "token".to_string(),
      namespace: None,
      doc: None,
      governance: "GOVERNANCE".to_string(),
      functions: vec![function.clone()],
      capabilities: Vec::new(),
      schemas: Vec::new(),
      constants: Vec::new(),
      uses: Vec::new(),
      implements: Vec::new(),
    };

    let generator = MarkdownGenerator::new();
    let options = DocsOptions::default();
    let md = generator
      .generate_function(&function, &module, &options)
      .unwrap();

    assert!(md.contains("#### `transfer`"));
    assert!(md.contains("transfer(from:string, to:string, amount:decimal):string"));
    assert!(md.contains("| `from` | `string` | Source account |"));
  }
}
