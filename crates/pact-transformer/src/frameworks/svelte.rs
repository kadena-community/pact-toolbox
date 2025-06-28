use super::{utils, AdditionalFile, CodeGenOptions, FrameworkGenerator, GeneratedCode};
use crate::ast::{PactFunction, PactModule};
use crate::types::pact_type_to_typescript;
use anyhow::Result;
use std::fmt::Write;

/// Svelte-specific code generator
pub struct SvelteGenerator {
  /// Use Svelte 5 runes
  use_runes: bool,
  /// Generate SvelteKit load functions
  generate_load_functions: bool,
  /// Use Svelte stores
  use_stores: bool,
}

impl SvelteGenerator {
  pub fn new() -> Self {
    Self {
      use_runes: true,
      use_stores: true,
      generate_load_functions: false,
    }
  }

  fn generate_stores(&self, modules: &[PactModule], typescript: bool) -> Result<String> {
    let mut code = String::new();

    // Add imports
    if self.use_runes {
      code.push_str("// Svelte 5 runes\n");
    } else {
      code.push_str("import { writable, derived, get } from 'svelte/store';\n");
    }

    // Import generated Pact functions
    for module in modules {
      code.push_str(&format!(
        "import * as {} from './{}';\n",
        module.name, module.name
      ));
    }

    code.push_str("\n");

    // Generate stores for each module
    for module in modules {
      code.push_str(&self.generate_module_store(module, typescript)?);
      code.push('\n');
    }

    Ok(code)
  }

  fn generate_module_store(&self, module: &PactModule, typescript: bool) -> Result<String> {
    let mut code = String::new();

    writeln!(&mut code, "// Store for {} module", module.name)?;

    if self.use_runes {
      // Svelte 5 runes implementation
      code.push_str(&self.generate_runes_store(module, typescript)?);
    } else {
      // Traditional Svelte stores
      code.push_str(&self.generate_traditional_store(module, typescript)?);
    }

    Ok(code)
  }

  fn generate_runes_store(&self, module: &PactModule, typescript: bool) -> Result<String> {
    let mut code = String::new();
    let class_name = format!("{}Store", utils::to_pascal_case(&module.name));

    writeln!(&mut code, "export class {} {{", class_name)?;

    // State with $state runes
    writeln!(&mut code, "  // State using Svelte 5 runes")?;
    writeln!(
      &mut code,
      "  items = $state{}([]);",
      if typescript { "<any[]>" } else { "" }
    )?;
    writeln!(
      &mut code,
      "  currentItem = $state{}(null);",
      if typescript { "<any>" } else { "" }
    )?;
    writeln!(&mut code, "  loading = $state(false);")?;
    writeln!(
      &mut code,
      "  error = $state{}(null);",
      if typescript { "<Error | null>" } else { "" }
    )?;
    writeln!(&mut code)?;

    // Derived state
    writeln!(&mut code, "  // Derived state")?;
    writeln!(&mut code, "  itemCount = $derived(this.items.length);")?;
    writeln!(&mut code, "  hasItems = $derived(this.items.length > 0);")?;
    writeln!(&mut code, "  isLoading = $derived(this.loading);")?;
    writeln!(&mut code, "  hasError = $derived(this.error !== null);")?;
    writeln!(&mut code)?;

    let (queries, mutations) = utils::group_functions_by_type(module);

    // Generate query methods
    writeln!(&mut code, "  // Query methods")?;
    for function in queries {
      code.push_str(&self.generate_rune_method(function, &module.name, false, typescript)?);
      code.push('\n');
    }

    // Generate mutation methods
    writeln!(&mut code, "  // Mutation methods")?;
    for function in mutations {
      code.push_str(&self.generate_rune_method(function, &module.name, true, typescript)?);
      code.push('\n');
    }

    // Reset method
    writeln!(&mut code, "  reset() {{")?;
    writeln!(&mut code, "    this.items = [];")?;
    writeln!(&mut code, "    this.currentItem = null;")?;
    writeln!(&mut code, "    this.loading = false;")?;
    writeln!(&mut code, "    this.error = null;")?;
    writeln!(&mut code, "  }}")?;

    writeln!(&mut code, "}}")?;
    writeln!(&mut code)?;
    writeln!(&mut code, "// Create singleton instance")?;
    writeln!(
      &mut code,
      "export const {} = new {}();",
      utils::to_camel_case(&module.name),
      class_name
    )?;

    Ok(code)
  }

  fn generate_traditional_store(&self, module: &PactModule, typescript: bool) -> Result<String> {
    let mut code = String::new();

    // Create writable stores
    writeln!(&mut code, "// Writable stores")?;
    writeln!(
      &mut code,
      "const items = writable{}([]);",
      if typescript { "<any[]>" } else { "" }
    )?;
    writeln!(
      &mut code,
      "const currentItem = writable{}(null);",
      if typescript { "<any>" } else { "" }
    )?;
    writeln!(&mut code, "const loading = writable(false);")?;
    writeln!(
      &mut code,
      "const error = writable{}(null);",
      if typescript { "<Error | null>" } else { "" }
    )?;
    writeln!(&mut code)?;

    // Create derived stores
    writeln!(&mut code, "// Derived stores")?;
    writeln!(
      &mut code,
      "const itemCount = derived(items, $items => $items.length);"
    )?;
    writeln!(
      &mut code,
      "const hasItems = derived(items, $items => $items.length > 0);"
    )?;
    writeln!(
      &mut code,
      "const isLoading = derived(loading, $loading => $loading);"
    )?;
    writeln!(
      &mut code,
      "const hasError = derived(error, $error => $error !== null);"
    )?;
    writeln!(&mut code)?;

    let (queries, mutations) = utils::group_functions_by_type(module);

    // Generate query functions
    writeln!(&mut code, "// Query functions")?;
    for function in queries {
      code.push_str(&self.generate_store_function(function, &module.name, false, typescript)?);
      code.push('\n');
    }

    // Generate mutation functions
    writeln!(&mut code, "// Mutation functions")?;
    for function in mutations {
      code.push_str(&self.generate_store_function(function, &module.name, true, typescript)?);
      code.push('\n');
    }

    // Reset function
    writeln!(&mut code, "function reset() {{")?;
    writeln!(&mut code, "  items.set([]);")?;
    writeln!(&mut code, "  currentItem.set(null);")?;
    writeln!(&mut code, "  loading.set(false);")?;
    writeln!(&mut code, "  error.set(null);")?;
    writeln!(&mut code, "}}")?;
    writeln!(&mut code)?;

    // Export store API
    writeln!(&mut code, "// Export store API")?;
    writeln!(
      &mut code,
      "export const {} = {{",
      utils::to_store_name(&module.name)
    )?;
    writeln!(&mut code, "  // State")?;
    writeln!(&mut code, "  subscribe: items.subscribe,")?;
    writeln!(&mut code, "  items: {{ subscribe: items.subscribe }},")?;
    writeln!(
      &mut code,
      "  currentItem: {{ subscribe: currentItem.subscribe }},"
    )?;
    writeln!(&mut code, "  loading: {{ subscribe: loading.subscribe }},")?;
    writeln!(&mut code, "  error: {{ subscribe: error.subscribe }},")?;
    writeln!(&mut code, "  // Derived")?;
    writeln!(
      &mut code,
      "  itemCount: {{ subscribe: itemCount.subscribe }},"
    )?;
    writeln!(
      &mut code,
      "  hasItems: {{ subscribe: hasItems.subscribe }},"
    )?;
    writeln!(
      &mut code,
      "  isLoading: {{ subscribe: isLoading.subscribe }},"
    )?;
    writeln!(
      &mut code,
      "  hasError: {{ subscribe: hasError.subscribe }},"
    )?;
    writeln!(&mut code, "  // Actions")?;

    for function in &module.functions {
      writeln!(&mut code, "  {},", utils::to_camel_case(&function.name))?;
    }

    writeln!(&mut code, "  reset,")?;
    writeln!(&mut code, "}};")?;

    Ok(code)
  }

  fn generate_rune_method(
    &self,
    function: &PactFunction,
    module_name: &str,
    is_mutation: bool,
    typescript: bool,
  ) -> Result<String> {
    let mut code = String::new();
    let method_name = utils::to_camel_case(&function.name);

    if let Some(doc) = &function.doc {
      writeln!(&mut code, "  /**")?;
      writeln!(&mut code, "   * {}", doc)?;
      writeln!(&mut code, "   */")?;
    }

    let params = self.generate_method_params(function, typescript);

    writeln!(&mut code, "  async {}({}) {{", method_name, params)?;
    writeln!(&mut code, "    this.loading = true;")?;
    writeln!(&mut code, "    this.error = null;")?;
    writeln!(&mut code)?;
    writeln!(&mut code, "    try {{")?;
    writeln!(
      &mut code,
      "      const result = await {}.{}({});",
      module_name,
      method_name,
      self.generate_param_list(function)
    )?;

    // Update state based on operation type
    if !is_mutation {
      if function.name.contains("list") || function.name.contains("get-all") {
        writeln!(&mut code, "      this.items = result;")?;
      } else if function.name.starts_with("get") {
        writeln!(&mut code, "      this.currentItem = result;")?;
      }
    } else {
      if function.name.starts_with("create") || function.name.starts_with("add") {
        writeln!(&mut code, "      this.items = [...this.items, result];")?;
      } else if function.name.starts_with("update") {
        writeln!(
          &mut code,
          "      const index = this.items.findIndex(item => item.id === result.id);"
        )?;
        writeln!(&mut code, "      if (index !== -1) {{")?;
        writeln!(&mut code, "        this.items[index] = result;")?;
        writeln!(&mut code, "      }}")?;
      } else if function.name.starts_with("delete") || function.name.starts_with("remove") {
        writeln!(
          &mut code,
          "      this.items = this.items.filter(item => item.id !== result.id);"
        )?;
      }
    }

    writeln!(&mut code, "      return result;")?;
    writeln!(&mut code, "    }} catch (err) {{")?;
    writeln!(
      &mut code,
      "      this.error = err{};",
      if typescript { " as Error" } else { "" }
    )?;
    writeln!(&mut code, "      throw err;")?;
    writeln!(&mut code, "    }} finally {{")?;
    writeln!(&mut code, "      this.loading = false;")?;
    writeln!(&mut code, "    }}")?;
    writeln!(&mut code, "  }}")?;

    Ok(code)
  }

  fn generate_store_function(
    &self,
    function: &PactFunction,
    module_name: &str,
    is_mutation: bool,
    typescript: bool,
  ) -> Result<String> {
    let mut code = String::new();
    let function_name = utils::to_camel_case(&function.name);

    if let Some(doc) = &function.doc {
      writeln!(&mut code, "/**")?;
      writeln!(&mut code, " * {}", doc)?;
      writeln!(&mut code, " */")?;
    }

    let params = self.generate_method_params(function, typescript);

    writeln!(&mut code, "async function {}({}) {{", function_name, params)?;
    writeln!(&mut code, "  loading.set(true);")?;
    writeln!(&mut code, "  error.set(null);")?;
    writeln!(&mut code)?;
    writeln!(&mut code, "  try {{")?;
    writeln!(
      &mut code,
      "    const result = await {}.{}({});",
      module_name,
      function_name,
      self.generate_param_list(function)
    )?;

    // Update stores based on operation type
    if !is_mutation {
      if function.name.contains("list") || function.name.contains("get-all") {
        writeln!(&mut code, "    items.set(result);")?;
      } else if function.name.starts_with("get") {
        writeln!(&mut code, "    currentItem.set(result);")?;
      }
    } else {
      if function.name.starts_with("create") || function.name.starts_with("add") {
        writeln!(
          &mut code,
          "    items.update($items => [...$items, result]);"
        )?;
      } else if function.name.starts_with("update") {
        writeln!(&mut code, "    items.update($items => {{")?;
        writeln!(
          &mut code,
          "      const index = $items.findIndex(item => item.id === result.id);"
        )?;
        writeln!(&mut code, "      if (index !== -1) {{")?;
        writeln!(&mut code, "        $items[index] = result;")?;
        writeln!(&mut code, "      }}")?;
        writeln!(&mut code, "      return $items;")?;
        writeln!(&mut code, "    }});")?;
      } else if function.name.starts_with("delete") || function.name.starts_with("remove") {
        writeln!(
          &mut code,
          "    items.update($items => $items.filter(item => item.id !== result.id));"
        )?;
      }
    }

    writeln!(&mut code, "    return result;")?;
    writeln!(&mut code, "  }} catch (err) {{")?;
    writeln!(
      &mut code,
      "    error.set(err{});",
      if typescript { " as Error" } else { "" }
    )?;
    writeln!(&mut code, "    throw err;")?;
    writeln!(&mut code, "  }} finally {{")?;
    writeln!(&mut code, "    loading.set(false);")?;
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code, "}}")?;

    Ok(code)
  }

  fn generate_load_function(&self, module: &PactModule, typescript: bool) -> Result<String> {
    let mut code = String::new();

    writeln!(
      &mut code,
      "// SvelteKit load function for {} module",
      module.name
    )?;
    writeln!(&mut code, "import type {{ PageLoad }} from './$types';")?;
    writeln!(
      &mut code,
      "import * as {} from '$lib/pact/{}';\n",
      module.name, module.name
    )?;

    writeln!(
      &mut code,
      "export const load{} = async ({{ params, url, fetch }}) => {{",
      if typescript { ": PageLoad" } else { "" }
    )?;

    writeln!(&mut code, "  const promises = [];")?;
    writeln!(&mut code)?;

    // Generate data fetching for query functions
    let queries: Vec<_> = module
      .functions
      .iter()
      .filter(|f| utils::is_query_function(f))
      .collect();

    for function in &queries {
      if function.parameters.is_empty() {
        writeln!(&mut code, "  // Fetch {} data", function.name)?;
        writeln!(
          &mut code,
          "  promises.push({}.{}());",
          module.name,
          utils::to_camel_case(&function.name)
        )?;
      } else {
        writeln!(
          &mut code,
          "  // {} requires parameters, skipping auto-fetch",
          function.name
        )?;
      }
    }

    writeln!(&mut code)?;
    writeln!(
      &mut code,
      "  const results = await Promise.allSettled(promises);"
    )?;
    writeln!(&mut code)?;
    writeln!(&mut code, "  return {{")?;

    let mut index = 0;
    for function in &queries {
      if function.parameters.is_empty() {
        writeln!(
          &mut code,
          "    {}: results[{}].status === 'fulfilled' ? results[{}].value : null,",
          utils::to_camel_case(&function.name),
          index,
          index
        )?;
        index += 1;
      }
    }

    writeln!(&mut code, "  }};")?;
    writeln!(&mut code, "}};")?;

    Ok(code)
  }

  fn generate_actions(&self, module: &PactModule, typescript: bool) -> Result<String> {
    let mut code = String::new();

    writeln!(&mut code, "// Svelte actions for {} module", module.name)?;
    writeln!(
      &mut code,
      "import * as {} from './{}';\n",
      module.name, module.name
    )?;

    // Generate action for data fetching on mount
    writeln!(&mut code, "/**")?;
    writeln!(&mut code, " * Svelte action to fetch data on element mount")?;
    writeln!(&mut code, " */")?;
    writeln!(
      &mut code,
      "export function {}Fetch(node{}, options{} = {{}}) {{",
      utils::to_camel_case(&module.name),
      if typescript { ": HTMLElement" } else { "" },
      if typescript {
        ": { autoFetch?: boolean, onSuccess?: (data: any) => void, onError?: (error: Error) => void }"
      } else {
        ""
      }
    )?;

    writeln!(
      &mut code,
      "  const {{ autoFetch = true, onSuccess, onError }} = options;"
    )?;
    writeln!(&mut code)?;
    writeln!(
      &mut code,
      "  let controller{};",
      if typescript {
        ": AbortController | null"
      } else {
        ""
      }
    )?;
    writeln!(&mut code)?;

    writeln!(&mut code, "  async function fetchData() {{")?;
    writeln!(&mut code, "    controller = new AbortController();")?;
    writeln!(&mut code)?;
    writeln!(&mut code, "    try {{")?;

    // Find a suitable default query function
    let default_query = module
      .functions
      .iter()
      .find(|f| utils::is_query_function(f) && f.parameters.is_empty());

    if let Some(query) = default_query {
      writeln!(
        &mut code,
        "      const data = await {}.{}();",
        module.name,
        utils::to_camel_case(&query.name)
      )?;
      writeln!(&mut code, "      if (onSuccess) onSuccess(data);")?;
    } else {
      writeln!(&mut code, "      // No default query function available")?;
    }

    writeln!(&mut code, "    }} catch (error) {{")?;
    writeln!(
      &mut code,
      "      if (error.name !== 'AbortError' && onError) {{"
    )?;
    writeln!(
      &mut code,
      "        onError(error{});",
      if typescript { " as Error" } else { "" }
    )?;
    writeln!(&mut code, "      }}")?;
    writeln!(&mut code, "    }}")?;
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code)?;

    writeln!(&mut code, "  if (autoFetch) {{")?;
    writeln!(&mut code, "    fetchData();")?;
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code)?;

    writeln!(&mut code, "  return {{")?;
    writeln!(
      &mut code,
      "    update(newOptions{}) {{",
      if typescript { ": typeof options" } else { "" }
    )?;
    writeln!(&mut code, "      Object.assign(options, newOptions);")?;
    writeln!(&mut code, "      if (newOptions.autoFetch) {{")?;
    writeln!(&mut code, "        fetchData();")?;
    writeln!(&mut code, "      }}")?;
    writeln!(&mut code, "    }},")?;
    writeln!(&mut code, "    destroy() {{")?;
    writeln!(&mut code, "      controller?.abort();")?;
    writeln!(&mut code, "    }}")?;
    writeln!(&mut code, "  }};")?;
    writeln!(&mut code, "}}")?;

    Ok(code)
  }

  fn generate_method_params(&self, function: &PactFunction, typescript: bool) -> String {
    if function.parameters.is_empty() {
      String::new()
    } else {
      function
        .parameters
        .iter()
        .map(|p| {
          if typescript {
            let ts_type = p
              .parameter_type
              .as_ref()
              .map(|t| pact_type_to_typescript(t))
              .unwrap_or_else(|| "any".to_string());
            format!("{}: {}", utils::to_camel_case(&p.name), ts_type)
          } else {
            utils::to_camel_case(&p.name)
          }
        })
        .collect::<Vec<_>>()
        .join(", ")
    }
  }

  fn generate_param_list(&self, function: &PactFunction) -> String {
    function
      .parameters
      .iter()
      .map(|p| utils::to_camel_case(&p.name))
      .collect::<Vec<_>>()
      .join(", ")
  }
}

impl FrameworkGenerator for SvelteGenerator {
  fn name(&self) -> &'static str {
    "svelte"
  }

  fn supported_patterns(&self) -> Vec<&'static str> {
    vec!["stores", "runes", "actions", "load-functions", "sveltekit"]
  }

  fn generate(&self, modules: &[PactModule], options: &CodeGenOptions) -> Result<GeneratedCode> {
    let typescript = options.typescript.unwrap_or(true);
    let mut additional_files = Vec::new();

    // Generate stores
    let stores_code = self.generate_stores(modules, typescript)?;

    // Generate SvelteKit load functions if requested
    if self.generate_load_functions
      || options.patterns.contains(&"load-functions".to_string())
      || options.patterns.contains(&"sveltekit".to_string())
    {
      for module in modules {
        additional_files.push(AdditionalFile {
          name: format!("+page.{}", if typescript { "ts" } else { "js" }),
          content: self.generate_load_function(module, typescript)?,
          description: Some(format!(
            "SvelteKit load function for {} module",
            module.name
          )),
        });
      }
    }

    // Generate Svelte actions if requested
    if options.patterns.contains(&"actions".to_string()) {
      for module in modules {
        additional_files.push(AdditionalFile {
          name: format!(
            "{}.actions.{}",
            module.name,
            if typescript { "ts" } else { "js" }
          ),
          content: self.generate_actions(module, typescript)?,
          description: Some(format!("Svelte actions for {} module", module.name)),
        });
      }
    }

    // Prepare imports
    let mut imports = vec![];

    if self.use_runes {
      imports.push("// Using Svelte 5 runes - no imports needed".to_string());
    } else {
      imports.push("import { writable, derived, readable, get } from 'svelte/store';".to_string());
    }

    // Prepare exports
    let exports = modules
      .iter()
      .map(|module| {
        if self.use_runes {
          format!("export {{ {} }};", utils::to_camel_case(&module.name))
        } else {
          format!("export {{ {} }};", utils::to_store_name(&module.name))
        }
      })
      .collect();

    Ok(GeneratedCode {
      code: stores_code,
      types: None, // Types are embedded in TypeScript files
      additional_files,
      imports,
      exports,
    })
  }

  fn file_extension(&self, typescript: bool) -> &'static str {
    if typescript {
      if self.use_runes {
        "svelte.ts"
      } else {
        "stores.ts"
      }
    } else {
      if self.use_runes {
        "svelte.js"
      } else {
        "stores.js"
      }
    }
  }
}

impl Default for SvelteGenerator {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::ast::{PactFunction, PactParameter};

  #[test]
  fn test_svelte_generator_creation() {
    let generator = SvelteGenerator::new();
    assert_eq!(generator.name(), "svelte");
    assert!(generator.supported_patterns().contains(&"stores"));
  }

  #[test]
  fn test_store_generation() {
    let generator = SvelteGenerator::new();

    let module = PactModule {
      name: "test".to_string(),
      namespace: None,
      governance: String::new(),
      doc: None,
      functions: vec![PactFunction {
        name: "get-user".to_string(),
        doc: Some("Get user by ID".to_string()),
        parameters: vec![PactParameter {
          name: "id".to_string(),
          parameter_type: Some("string".to_string()),
        }],
        return_type: Some("object{user}".to_string()),
        body: String::new(),
        is_defun: true,
      }],
      capabilities: vec![],
      schemas: vec![],
      constants: vec![],
      uses: vec![],
      implements: vec![],
    };

    let options = CodeGenOptions::default();
    let result = generator.generate(&[module], &options).unwrap();

    // Should use runes by default
    assert!(result.code.contains("$state"));
    assert!(result.code.contains("TestStore"));
  }
}
