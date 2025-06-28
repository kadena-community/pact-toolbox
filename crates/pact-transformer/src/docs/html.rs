use super::{
  utils, DocsGenerator, DocsOptions, Documentation, SearchDocument, SearchIndex, TableOfContents,
  TocSection,
};
use crate::ast::{PactCapability, PactConstant, PactFunction, PactModule, PactSchema};
use anyhow::Result;
use std::collections::HashMap;
use std::fmt::Write;

/// HTML documentation generator
pub struct HtmlGenerator {
  /// Template engine
  templates: HashMap<String, String>,
}

impl HtmlGenerator {
  pub fn new() -> Self {
    let templates = HashMap::new();

    // Base HTML template
    // templates.insert("base".to_string(), include_str!("../templates/docs/base.html").to_string());

    // Component templates
    // templates.insert("module".to_string(), include_str!("../templates/docs/module.html").to_string());
    // templates.insert("function".to_string(), include_str!("../templates/docs/function.html").to_string());
    // templates.insert("schema".to_string(), include_str!("../templates/docs/schema.html").to_string());

    Self { templates }
  }

  fn get_base_template(&self, options: &DocsOptions) -> String {
    let theme = options.theme.as_deref().unwrap_or("default");

    format!(
      r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{{{title}}}}</title>
    <meta name="description" content="{{{{description}}}}">
    <meta name="generator" content="pact-transformer">
    
    <!-- Base styles -->
    <link rel="stylesheet" href="{{{{base_url}}}}assets/css/style.css">
    <link rel="stylesheet" href="{{{{base_url}}}}assets/css/theme-{}.css">
    
    <!-- Syntax highlighting -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-{}.min.css">
    
    {{{{custom_css}}}}
</head>
<body class="docs-theme-{}">
    <div class="docs-container">
        <!-- Sidebar -->
        <aside class="docs-sidebar">
            <div class="docs-sidebar-header">
                <h2 class="docs-logo">{{{{title}}}}</h2>
                {{{{search_box}}}}
            </div>
            <nav class="docs-nav">
                {{{{toc}}}}
            </nav>
        </aside>
        
        <!-- Main content -->
        <main class="docs-main">
            <div class="docs-content">
                {{{{content}}}}
            </div>
        </main>
    </div>
    
    <!-- Scripts -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-lisp.min.js"></script>
    <script src="{{{{base_url}}}}assets/js/docs.js"></script>
    
    {{{{search_script}}}}
    {{{{playground_script}}}}
    {{{{custom_js}}}}
</body>
</html>"#,
      theme,
      options.syntax_theme.as_deref().unwrap_or("tomorrow"),
      theme
    )
  }

  fn generate_css(&self, _options: &DocsOptions) -> String {
    let primary_color = "#2563eb"; // Blue
    let secondary_color = "#10b981"; // Green

    format!(
      r#":root {{
    --primary-color: {};
    --secondary-color: {};
    --bg-color: #ffffff;
    --text-color: #1f2937;
    --border-color: #e5e7eb;
    --code-bg: #f3f4f6;
    --sidebar-bg: #f9fafb;
    --sidebar-width: 280px;
}}

/* Dark theme */
@media (prefers-color-scheme: dark) {{
    :root {{
        --bg-color: #111827;
        --text-color: #f3f4f6;
        --border-color: #374151;
        --code-bg: #1f2937;
        --sidebar-bg: #0f172a;
    }}
}}

/* Base layout */
body {{
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: var(--text-color);
    background: var(--bg-color);
    line-height: 1.6;
}}

.docs-container {{
    display: flex;
    min-height: 100vh;
}}

/* Sidebar */
.docs-sidebar {{
    width: var(--sidebar-width);
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border-color);
    position: fixed;
    height: 100vh;
    overflow-y: auto;
}}

.docs-sidebar-header {{
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
}}

.docs-logo {{
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    color: var(--primary-color);
}}

/* Navigation */
.docs-nav {{
    padding: 1rem 0;
}}

.docs-nav ul {{
    list-style: none;
    margin: 0;
    padding: 0;
}}

.docs-nav li {{
    margin: 0;
}}

.docs-nav a {{
    display: block;
    padding: 0.5rem 1.5rem;
    color: var(--text-color);
    text-decoration: none;
    transition: all 0.2s;
}}

.docs-nav a:hover {{
    background: var(--border-color);
    color: var(--primary-color);
}}

.docs-nav a.active {{
    background: var(--primary-color);
    color: white;
}}

/* Main content */
.docs-main {{
    margin-left: var(--sidebar-width);
    flex: 1;
    min-width: 0;
}}

.docs-content {{
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
}}

/* Typography */
h1, h2, h3, h4, h5, h6 {{
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-weight: 600;
}}

h1 {{ font-size: 2.5rem; }}
h2 {{ font-size: 2rem; }}
h3 {{ font-size: 1.5rem; }}
h4 {{ font-size: 1.25rem; }}

/* Code blocks */
pre {{
    background: var(--code-bg);
    border-radius: 0.5rem;
    padding: 1rem;
    overflow-x: auto;
}}

code {{
    background: var(--code-bg);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.875rem;
}}

pre code {{
    background: transparent;
    padding: 0;
}}

/* Function signature */
.function-signature {{
    background: var(--code-bg);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1rem 0;
    font-family: monospace;
    font-size: 1.1rem;
}}

/* Parameters table */
.params-table {{
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
}}

.params-table th,
.params-table td {{
    border: 1px solid var(--border-color);
    padding: 0.75rem;
    text-align: left;
}}

.params-table th {{
    background: var(--sidebar-bg);
    font-weight: 600;
}}

/* Examples */
.example {{
    background: var(--sidebar-bg);
    border-left: 4px solid var(--primary-color);
    padding: 1rem;
    margin: 1rem 0;
}}

.example-title {{
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--primary-color);
}}

/* Search */
.search-box {{
    position: relative;
}}

.search-input {{
    width: 100%;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    background: var(--bg-color);
    color: var(--text-color);
}}

.search-results {{
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    margin-top: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}}

/* Playground */
.playground {{
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    margin: 1rem 0;
}}

.playground-header {{
    background: var(--sidebar-bg);
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
}}

.playground-editor {{
    padding: 1rem;
}}

.playground-output {{
    background: var(--code-bg);
    padding: 1rem;
    border-top: 1px solid var(--border-color);
    min-height: 100px;
}}

/* Responsive */
@media (max-width: 768px) {{
    .docs-sidebar {{
        width: 100%;
        position: relative;
        height: auto;
    }}
    
    .docs-main {{
        margin-left: 0;
    }}
    
    .docs-container {{
        flex-direction: column;
    }}
}}"#,
      primary_color, secondary_color
    )
  }

  fn generate_js(&self, options: &DocsOptions) -> String {
    let mut js = String::new();

    // Base JavaScript
    js.push_str("// Documentation functionality\n");
    js.push_str("document.addEventListener('DOMContentLoaded', function() {\n");
    js.push_str("    // Smooth scrolling for anchor links\n");
    js.push_str("    document.querySelectorAll('a[href^=\"#\"]').forEach(anchor => {\n");
    js.push_str("        anchor.addEventListener('click', function (e) {\n");
    js.push_str("            e.preventDefault();\n");
    js.push_str("            const target = document.querySelector(this.getAttribute('href'));\n");
    js.push_str("            if (target) {\n");
    js.push_str("                target.scrollIntoView({ behavior: 'smooth', block: 'start' });\n");
    js.push_str("            }\n");
    js.push_str("        });\n");
    js.push_str("    });\n");
    js.push_str("    \n");
    js.push_str("    // Active navigation highlighting\n");
    js.push_str("    const updateActiveNav = () => {\n");
    js.push_str("        const sections = document.querySelectorAll('h2[id], h3[id]');\n");
    js.push_str("        const navLinks = document.querySelectorAll('.docs-nav a');\n");
    js.push_str("        \n");
    js.push_str("        let currentSection = '';\n");
    js.push_str("        sections.forEach(section => {\n");
    js.push_str("            const rect = section.getBoundingClientRect();\n");
    js.push_str("            if (rect.top <= 100) {\n");
    js.push_str("                currentSection = section.id;\n");
    js.push_str("            }\n");
    js.push_str("        });\n");
    js.push_str("        \n");
    js.push_str("        navLinks.forEach(link => {\n");
    js.push_str("            link.classList.remove('active');\n");
    js.push_str("            if (link.getAttribute('href') === '#' + currentSection) {\n");
    js.push_str("                link.classList.add('active');\n");
    js.push_str("            }\n");
    js.push_str("        });\n");
    js.push_str("    };\n");
    js.push_str("    \n");
    js.push_str("    window.addEventListener('scroll', updateActiveNav);\n");
    js.push_str("    updateActiveNav();\n");
    js.push_str("    \n");
    js.push_str("    // Copy code button\n");
    js.push_str("    document.querySelectorAll('pre').forEach(pre => {\n");
    js.push_str("        const button = document.createElement('button');\n");
    js.push_str("        button.className = 'copy-button';\n");
    js.push_str("        button.textContent = 'Copy';\n");
    js.push_str("        button.addEventListener('click', () => {\n");
    js.push_str("            const code = pre.querySelector('code').textContent;\n");
    js.push_str("            navigator.clipboard.writeText(code).then(() => {\n");
    js.push_str("                button.textContent = 'Copied!';\n");
    js.push_str("                setTimeout(() => { button.textContent = 'Copy'; }, 2000);\n");
    js.push_str("            });\n");
    js.push_str("        });\n");
    js.push_str("        pre.appendChild(button);\n");
    js.push_str("    });\n");
    js.push_str("    \n");
    js.push_str("    // Collapsible sections\n");
    js.push_str("    document.querySelectorAll('.collapsible').forEach(section => {\n");
    js.push_str("        const header = section.querySelector('.collapsible-header');\n");
    js.push_str("        header.addEventListener('click', () => {\n");
    js.push_str("            section.classList.toggle('collapsed');\n");
    js.push_str("        });\n");
    js.push_str("    });\n");
    js.push_str("});\n");

    // Add search functionality if enabled
    js.push_str("\n// Search functionality\n");
    if options.search_enabled.unwrap_or(true) {
      js.push_str(&self.generate_search_js());
    } else {
      js.push_str("// Search disabled");
    }

    // Add playground functionality if enabled
    js.push_str("\n\n// Playground functionality\n");
    if options.api_playground.unwrap_or(false) {
      js.push_str(&self.generate_playground_js());
    } else {
      js.push_str("// Playground disabled");
    }

    js
  }

  fn generate_search_js(&self) -> String {
    r#"
class DocSearch {
    constructor() {
        this.searchInput = document.querySelector('.search-input');
        this.searchResults = document.querySelector('.search-results');
        this.searchIndex = null;
        
        if (this.searchInput) {
            this.init();
        }
    }
    
    async init() {
        // Load search index
        const response = await fetch('search-index.json');
        this.searchIndex = await response.json();
        
        // Setup event listeners
        this.searchInput.addEventListener('input', (e) => this.search(e.target.value));
        this.searchInput.addEventListener('focus', () => this.showResults());
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-box')) {
                this.hideResults();
            }
        });
    }
    
    search(query) {
        if (!query || query.length < 2) {
            this.hideResults();
            return;
        }
        
        const results = this.searchIndex.documents.filter(doc => {
            const searchText = `${doc.title} ${doc.content}`.toLowerCase();
            return searchText.includes(query.toLowerCase());
        }).slice(0, 10);
        
        this.displayResults(results);
    }
    
    displayResults(results) {
        if (results.length === 0) {
            this.searchResults.innerHTML = '<div class="no-results">No results found</div>';
        } else {
            this.searchResults.innerHTML = results.map(result => `
                <a href="${result.url}" class="search-result">
                    <div class="search-result-title">${result.title}</div>
                    <div class="search-result-category">${result.category}</div>
                </a>
            `).join('');
        }
        
        this.showResults();
    }
    
    showResults() {
        this.searchResults.style.display = 'block';
    }
    
    hideResults() {
        this.searchResults.style.display = 'none';
    }
}

new DocSearch();"#
      .to_string()
  }

  fn generate_playground_js(&self) -> String {
    r#"
class PactPlayground {
    constructor() {
        this.playgrounds = document.querySelectorAll('.playground');
        this.init();
    }
    
    init() {
        this.playgrounds.forEach(playground => {
            const editor = playground.querySelector('.playground-editor textarea');
            const runButton = playground.querySelector('.playground-run');
            const output = playground.querySelector('.playground-output');
            
            if (editor && runButton && output) {
                runButton.addEventListener('click', () => this.runCode(editor.value, output));
            }
        });
    }
    
    async runCode(code, outputElement) {
        outputElement.innerHTML = '<div class="loading">Running...</div>';
        
        try {
            // This would connect to your Pact execution backend
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            
            const result = await response.json();
            
            if (result.success) {
                outputElement.innerHTML = `<pre class="success">${result.output}</pre>`;
            } else {
                outputElement.innerHTML = `<pre class="error">${result.error}</pre>`;
            }
        } catch (error) {
            outputElement.innerHTML = `<pre class="error">Error: ${error.message}</pre>`;
        }
    }
}

new PactPlayground();"#
      .to_string()
  }
}

impl DocsGenerator for HtmlGenerator {
  fn name(&self) -> &'static str {
    "html"
  }

  fn generate(&self, modules: &[PactModule], options: &DocsOptions) -> Result<Documentation> {
    let mut assets = HashMap::new();

    // Generate CSS
    assets.insert(
      "assets/css/style.css".to_string(),
      self.generate_css(options).into_bytes(),
    );

    // Generate JavaScript
    assets.insert(
      "assets/js/docs.js".to_string(),
      self.generate_js(options).into_bytes(),
    );

    // Generate main content
    let content = self.generate_index(modules, options)?;

    // Generate TOC
    let toc = self.generate_toc(modules, options)?;

    // Generate search index
    let search_index = if options.search_enabled.unwrap_or(true) {
      Some(self.generate_search_index(modules, options)?)
    } else {
      None
    };

    // Generate metadata
    let metadata = utils::generate_metadata(modules, self.name());

    Ok(Documentation {
      content,
      assets,
      toc: Some(toc),
      search_index,
      metadata,
    })
  }

  fn generate_index(&self, modules: &[PactModule], options: &DocsOptions) -> Result<String> {
    let mut html = String::new();

    // Header
    writeln!(&mut html, "<h1>Pact Contract Documentation</h1>")?;
    writeln!(
      &mut html,
      "<p class=\"generated-at\">Generated at: {}</p>",
      chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    )?;

    // Overview
    writeln!(&mut html, "<section class=\"overview\">")?;
    writeln!(&mut html, "<h2>Overview</h2>")?;
    writeln!(&mut html, "<div class=\"stats\">")?;
    writeln!(&mut html, "<div class=\"stat-card\">")?;
    writeln!(
      &mut html,
      "<div class=\"stat-value\">{}</div>",
      modules.len()
    )?;
    writeln!(&mut html, "<div class=\"stat-label\">Modules</div>")?;
    writeln!(&mut html, "</div>")?;

    let total_functions: usize = modules.iter().map(|m| m.functions.len()).sum();
    writeln!(&mut html, "<div class=\"stat-card\">")?;
    writeln!(
      &mut html,
      "<div class=\"stat-value\">{}</div>",
      total_functions
    )?;
    writeln!(&mut html, "<div class=\"stat-label\">Functions</div>")?;
    writeln!(&mut html, "</div>")?;

    let total_schemas: usize = modules.iter().map(|m| m.schemas.len()).sum();
    writeln!(&mut html, "<div class=\"stat-card\">")?;
    writeln!(
      &mut html,
      "<div class=\"stat-value\">{}</div>",
      total_schemas
    )?;
    writeln!(&mut html, "<div class=\"stat-label\">Schemas</div>")?;
    writeln!(&mut html, "</div>")?;
    writeln!(&mut html, "</div>")?;
    writeln!(&mut html, "</section>")?;

    // Module documentation
    for module in modules {
      writeln!(&mut html, "{}", self.generate_module(module, options)?)?;
    }

    Ok(html)
  }

  fn generate_module(&self, module: &PactModule, options: &DocsOptions) -> Result<String> {
    let mut html = String::new();
    let module_id = utils::generate_id(&module.name);

    writeln!(
      &mut html,
      "<section class=\"module\" id=\"module-{}\">`",
      module_id
    )?;
    writeln!(&mut html, "<h2>{}</h2>", module.name)?;

    if let Some(doc) = &module.doc {
      writeln!(
        &mut html,
        "<div class=\"module-doc\">{}</div>",
        utils::clean_doc(doc)
      )?;
    }

    // Module metadata
    writeln!(&mut html, "<div class=\"module-meta\">")?;
    writeln!(
      &mut html,
      "<span class=\"meta-item\">Governance: <code>{}</code></span>",
      module.governance
    )?;
    if let Some(ns) = &module.namespace {
      writeln!(
        &mut html,
        "<span class=\"meta-item\">Namespace: <code>{}</code></span>",
        ns
      )?;
    }
    writeln!(&mut html, "</div>")?;

    // Functions
    if !module.functions.is_empty() {
      writeln!(&mut html, "<h3>Functions</h3>")?;
      writeln!(&mut html, "<div class=\"function-list\">")?;
      for function in &module.functions {
        writeln!(
          &mut html,
          "{}",
          self.generate_function(function, module, options)?
        )?;
      }
      writeln!(&mut html, "</div>")?;
    }

    // Capabilities
    if !module.capabilities.is_empty() {
      writeln!(&mut html, "<h3>Capabilities</h3>")?;
      writeln!(&mut html, "<div class=\"capability-list\">")?;
      for capability in &module.capabilities {
        writeln!(
          &mut html,
          "{}",
          self.generate_capability(capability, module, options)?
        )?;
      }
      writeln!(&mut html, "</div>")?;
    }

    // Schemas
    if !module.schemas.is_empty() {
      writeln!(&mut html, "<h3>Schemas</h3>")?;
      writeln!(&mut html, "<div class=\"schema-list\">")?;
      for schema in &module.schemas {
        writeln!(
          &mut html,
          "{}",
          self.generate_schema(schema, module, options)?
        )?;
      }
      writeln!(&mut html, "</div>")?;
    }

    // Constants
    if !module.constants.is_empty() {
      writeln!(&mut html, "<h3>Constants</h3>")?;
      writeln!(&mut html, "<div class=\"constant-list\">")?;
      for constant in &module.constants {
        writeln!(
          &mut html,
          "{}",
          self.generate_constant(constant, module, options)?
        )?;
      }
      writeln!(&mut html, "</div>")?;
    }

    writeln!(&mut html, "</section>")?;

    Ok(html)
  }

  fn generate_function(
    &self,
    function: &PactFunction,
    module: &PactModule,
    options: &DocsOptions,
  ) -> Result<String> {
    let mut html = String::new();
    let function_id = utils::generate_id(&format!("{}-{}", module.name, function.name));

    writeln!(
      &mut html,
      "<div class=\"function\" id=\"function-{}\">`",
      function_id
    )?;
    writeln!(&mut html, "<h4>{}</h4>", function.name)?;

    // Signature
    writeln!(&mut html, "<div class=\"function-signature\">")?;
    writeln!(
      &mut html,
      "<code>{}</code>",
      utils::generate_signature(function)
    )?;
    writeln!(&mut html, "</div>")?;

    // Documentation
    if let Some(doc) = &function.doc {
      writeln!(
        &mut html,
        "<div class=\"function-doc\">{}</div>",
        utils::clean_doc(doc)
      )?;

      // Examples
      let examples = utils::extract_examples(doc);
      if !examples.is_empty() && options.include_examples.unwrap_or(true) {
        writeln!(&mut html, "<div class=\"examples\">")?;
        writeln!(&mut html, "<h5>Examples</h5>")?;
        for example in examples {
          writeln!(&mut html, "<div class=\"example\">")?;
          writeln!(
            &mut html,
            "<pre><code class=\"language-lisp\">{}</code></pre>",
            example
          )?;
          if options.interactive_examples.unwrap_or(false) {
            writeln!(
              &mut html,
              "<button class=\"run-example\" data-code=\"{}\">Run</button>",
              html_escape::encode_double_quoted_attribute(&example)
            )?;
          }
          writeln!(&mut html, "</div>")?;
        }
        writeln!(&mut html, "</div>")?;
      }
    }

    // Parameters
    if !function.parameters.is_empty() {
      writeln!(&mut html, "<div class=\"parameters\">")?;
      writeln!(&mut html, "<h5>Parameters</h5>")?;
      writeln!(&mut html, "<table class=\"params-table\">")?;
      writeln!(
        &mut html,
        "<thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>"
      )?;
      writeln!(&mut html, "<tbody>")?;

      for param in &function.parameters {
        writeln!(&mut html, "<tr>")?;
        writeln!(&mut html, "<td><code>{}</code></td>", param.name)?;
        writeln!(
          &mut html,
          "<td><code>{}</code></td>",
          param.parameter_type.as_deref().unwrap_or("any")
        )?;
        writeln!(
          &mut html,
          "<td>{}</td>",
          if let Some(doc) = &function.doc {
            utils::extract_tag(doc, &format!("@param {}", param.name)).unwrap_or_default()
          } else {
            String::new()
          }
        )?;
        writeln!(&mut html, "</tr>")?;
      }

      writeln!(&mut html, "</tbody></table>")?;
      writeln!(&mut html, "</div>")?;
    }

    // Return value
    if let Some(return_type) = &function.return_type {
      writeln!(&mut html, "<div class=\"return-value\">")?;
      writeln!(&mut html, "<h5>Returns</h5>")?;
      writeln!(&mut html, "<p><code>{}</code>", return_type)?;
      if let Some(doc) = &function.doc {
        if let Some(return_doc) = utils::extract_tag(doc, "@return") {
          writeln!(&mut html, " - {}", return_doc)?;
        }
      }
      writeln!(&mut html, "</p>")?;
      writeln!(&mut html, "</div>")?;
    }

    writeln!(&mut html, "</div>")?;

    Ok(html)
  }

  fn generate_capability(
    &self,
    capability: &PactCapability,
    module: &PactModule,
    _options: &DocsOptions,
  ) -> Result<String> {
    let mut html = String::new();
    let cap_id = utils::generate_id(&format!("{}-{}", module.name, capability.name));

    writeln!(
      &mut html,
      "<div class=\"capability\" id=\"capability-{}\">`",
      cap_id
    )?;
    writeln!(&mut html, "<h4>{}</h4>", capability.name)?;

    if capability.is_event {
      writeln!(&mut html, "<span class=\"badge event-badge\">Event</span>")?;
    }

    if let Some(doc) = &capability.doc {
      writeln!(
        &mut html,
        "<div class=\"capability-doc\">{}</div>",
        utils::clean_doc(doc)
      )?;
    }

    if let Some(managed) = &capability.managed {
      writeln!(&mut html, "<div class=\"managed-info\">")?;
      writeln!(
        &mut html,
        "<strong>Managed:</strong> Parameter <code>{}</code>",
        managed.parameter
      )?;
      if let Some(mgr) = &managed.manager_function {
        writeln!(&mut html, " (Manager: <code>{}</code>)", mgr)?;
      }
      writeln!(&mut html, "</div>")?;
    }

    writeln!(&mut html, "</div>")?;

    Ok(html)
  }

  fn generate_schema(
    &self,
    schema: &PactSchema,
    module: &PactModule,
    _options: &DocsOptions,
  ) -> Result<String> {
    let mut html = String::new();
    let schema_id = utils::generate_id(&format!("{}-{}", module.name, schema.name));

    writeln!(
      &mut html,
      "<div class=\"schema\" id=\"schema-{}\">`",
      schema_id
    )?;
    writeln!(&mut html, "<h4>{}</h4>", schema.name)?;

    if let Some(doc) = &schema.doc {
      writeln!(
        &mut html,
        "<div class=\"schema-doc\">{}</div>",
        utils::clean_doc(doc)
      )?;
    }

    writeln!(&mut html, "<div class=\"schema-fields\">")?;
    writeln!(&mut html, "<h5>Fields</h5>")?;
    writeln!(&mut html, "<table class=\"fields-table\">")?;
    writeln!(
      &mut html,
      "<thead><tr><th>Field</th><th>Type</th></tr></thead>"
    )?;
    writeln!(&mut html, "<tbody>")?;

    for field in &schema.fields {
      writeln!(&mut html, "<tr>")?;
      writeln!(&mut html, "<td><code>{}</code></td>", field.name)?;
      writeln!(&mut html, "<td><code>{}</code></td>", field.field_type)?;
      writeln!(&mut html, "</tr>")?;
    }

    writeln!(&mut html, "</tbody></table>")?;
    writeln!(&mut html, "</div>")?;
    writeln!(&mut html, "</div>")?;

    Ok(html)
  }

  fn generate_constant(
    &self,
    constant: &PactConstant,
    module: &PactModule,
    _options: &DocsOptions,
  ) -> Result<String> {
    let mut html = String::new();
    let const_id = utils::generate_id(&format!("{}-{}", module.name, constant.name));

    writeln!(
      &mut html,
      "<div class=\"constant\" id=\"constant-{}\">`",
      const_id
    )?;
    writeln!(&mut html, "<h4>{}</h4>", constant.name)?;

    writeln!(&mut html, "<div class=\"constant-value\">")?;
    writeln!(
      &mut html,
      "<code>{}: {} = {}</code>",
      constant.name,
      constant.constant_type.as_deref().unwrap_or("any"),
      constant.value
    )?;
    writeln!(&mut html, "</div>")?;

    if let Some(doc) = &constant.doc {
      writeln!(
        &mut html,
        "<div class=\"constant-doc\">{}</div>",
        utils::clean_doc(doc)
      )?;
    }

    writeln!(&mut html, "</div>")?;

    Ok(html)
  }
}

impl HtmlGenerator {
  fn generate_toc(
    &self,
    modules: &[PactModule],
    _options: &DocsOptions,
  ) -> Result<TableOfContents> {
    let mut sections = Vec::new();

    for module in modules {
      let module_id = utils::generate_id(&module.name);
      let mut module_section = TocSection {
        title: module.name.clone(),
        id: format!("module-{}", module_id),
        level: 1,
        children: Vec::new(),
      };

      // Add functions
      if !module.functions.is_empty() {
        let mut functions_section = TocSection {
          title: "Functions".to_string(),
          id: format!("module-{}-functions", module_id),
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

      // Add capabilities
      if !module.capabilities.is_empty() {
        let mut caps_section = TocSection {
          title: "Capabilities".to_string(),
          id: format!("module-{}-capabilities", module_id),
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

      // Add schemas
      if !module.schemas.is_empty() {
        let mut schemas_section = TocSection {
          title: "Schemas".to_string(),
          id: format!("module-{}-schemas", module_id),
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

      sections.push(module_section);
    }

    Ok(TableOfContents { sections })
  }

  fn generate_search_index(
    &self,
    modules: &[PactModule],
    _options: &DocsOptions,
  ) -> Result<SearchIndex> {
    let mut documents = Vec::new();

    for module in modules {
      // Index module
      documents.push(SearchDocument {
        id: format!("module-{}", utils::generate_id(&module.name)),
        title: module.name.clone(),
        content: module.doc.as_deref().unwrap_or("").to_string(),
        url: format!("#module-{}", utils::generate_id(&module.name)),
        category: "Module".to_string(),
      });

      // Index functions
      for function in &module.functions {
        documents.push(SearchDocument {
          id: format!(
            "function-{}-{}",
            utils::generate_id(&module.name),
            utils::generate_id(&function.name)
          ),
          title: format!("{}.{}", module.name, function.name),
          content: function.doc.as_deref().unwrap_or("").to_string(),
          url: format!(
            "#function-{}-{}",
            utils::generate_id(&module.name),
            utils::generate_id(&function.name)
          ),
          category: "Function".to_string(),
        });
      }

      // Index schemas
      for schema in &module.schemas {
        documents.push(SearchDocument {
          id: format!(
            "schema-{}-{}",
            utils::generate_id(&module.name),
            utils::generate_id(&schema.name)
          ),
          title: format!("{}.{}", module.name, schema.name),
          content: schema.doc.as_deref().unwrap_or("").to_string(),
          url: format!(
            "#schema-{}-{}",
            utils::generate_id(&module.name),
            utils::generate_id(&schema.name)
          ),
          category: "Schema".to_string(),
        });
      }
    }

    // Create a simple JSON index (could be enhanced with Lunr.js)
    let index = serde_json::json!({
        "version": "1.0",
        "documents": documents.len()
    });

    Ok(SearchIndex { documents, index })
  }
}

impl Default for HtmlGenerator {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::ast::{PactFunction, PactParameter};

  #[test]
  fn test_html_generator() {
    let generator = HtmlGenerator::new();
    assert_eq!(generator.name(), "html");
  }

  #[test]
  fn test_signature_generation() {
    let function = PactFunction {
      name: "test-function".to_string(),
      doc: Some("Test function".to_string()),
      parameters: vec![
        PactParameter {
          name: "amount".to_string(),
          parameter_type: Some("decimal".to_string()),
        },
        PactParameter {
          name: "account".to_string(),
          parameter_type: Some("string".to_string()),
        },
      ],
      return_type: Some("string".to_string()),
      body: String::new(),
      is_defun: true,
    };

    let signature = utils::generate_signature(&function);
    assert_eq!(
      signature,
      "test-function(amount:decimal, account:string):string"
    );
  }
}
