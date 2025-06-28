use super::{utils, AdditionalFile, CodeGenOptions, FrameworkGenerator, GeneratedCode};
use crate::ast::{PactFunction, PactModule};
use crate::types::pact_type_to_typescript;
use anyhow::Result;
use std::fmt::Write;

/// Vue-specific code generator
pub struct VueGenerator {
  /// Vue version (2 or 3)
  vue_version: u8,
  /// Use Composition API
  use_composition_api: bool,
  /// Generate Pinia stores
  generate_stores: bool,
  /// Use VueQuery for data fetching
  use_vue_query: bool,
}

impl VueGenerator {
  pub fn new() -> Self {
    Self {
      vue_version: 3,
      use_composition_api: true,
      generate_stores: true,
      use_vue_query: false,
    }
  }

  fn generate_composables(&self, modules: &[PactModule], typescript: bool) -> Result<String> {
    let mut code = String::new();

    // Add imports
    if self.vue_version == 3 {
      code.push_str(
        "import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';\n",
      );
    } else {
      code.push_str("import { ref, reactive, computed, watch } from '@vue/composition-api';\n");
    }

    if self.use_vue_query {
      code
        .push_str("import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';\n");
    }

    // Import generated Pact functions
    for module in modules {
      code.push_str(&format!(
        "import * as {} from './{}';\n",
        module.name, module.name
      ));
    }

    code.push_str("\n");

    // Generate composables for each module
    for module in modules {
      code.push_str(&self.generate_module_composables(module, typescript)?);
    }

    Ok(code)
  }

  fn generate_module_composables(&self, module: &PactModule, typescript: bool) -> Result<String> {
    let mut code = String::new();

    // Add module comment
    writeln!(&mut code, "// Composables for {} module", module.name)?;
    writeln!(&mut code)?;

    let (queries, mutations) = utils::group_functions_by_type(module);

    // Generate query composables
    for function in queries {
      code.push_str(&self.generate_query_composable(function, &module.name, typescript)?);
      code.push('\n');
    }

    // Generate mutation composables
    for function in mutations {
      code.push_str(&self.generate_mutation_composable(function, &module.name, typescript)?);
      code.push('\n');
    }

    // Generate module-level composable that combines all functions
    code.push_str(&self.generate_module_composable(module, typescript)?);

    Ok(code)
  }

  fn generate_query_composable(
    &self,
    function: &PactFunction,
    module_name: &str,
    typescript: bool,
  ) -> Result<String> {
    let mut code = String::new();
    let composable_name = utils::to_composable_name(&function.name);

    // Generate JSDoc
    if let Some(doc) = &function.doc {
      writeln!(&mut code, "/**")?;
      writeln!(&mut code, " * {}", doc)?;
      writeln!(&mut code, " * @returns Reactive query state")?;
      writeln!(&mut code, " */")?;
    }

    // Generate function signature
    let params = self.generate_composable_params(function, typescript);

    writeln!(
      &mut code,
      "export function {}({}) {{",
      composable_name, params
    )?;

    if self.use_vue_query {
      // VueQuery implementation
      let query_key = self.generate_query_key(function);
      let query_fn = format!("{}.{}", module_name, utils::to_camel_case(&function.name));

      writeln!(&mut code, "  return useQuery({{")?;
      writeln!(&mut code, "    queryKey: [{}],", query_key)?;
      writeln!(
        &mut code,
        "    queryFn: () => {}({}),",
        query_fn,
        self.generate_param_refs(function)
      )?;

      if function.name.contains("list") || function.name.contains("get-all") {
        writeln!(&mut code, "    staleTime: 5 * 60 * 1000, // 5 minutes")?;
      }

      writeln!(&mut code, "  }});")?;
    } else {
      // Manual reactive implementation
      writeln!(
        &mut code,
        "  const data = ref{}(null);",
        if typescript { "<any>" } else { "" }
      )?;
      writeln!(&mut code, "  const loading = ref(false);")?;
      writeln!(
        &mut code,
        "  const error = ref{}(null);",
        if typescript { "<Error | null>" } else { "" }
      )?;
      writeln!(&mut code)?;

      // Create reactive params
      if !function.parameters.is_empty() {
        writeln!(&mut code, "  // Make parameters reactive")?;
        for param in &function.parameters {
          let param_name = utils::to_camel_case(&param.name);
          writeln!(
            &mut code,
            "  const {}Ref = ref({});",
            param_name, param_name
          )?;
        }
        writeln!(&mut code)?;
      }

      writeln!(&mut code, "  const fetch = async () => {{")?;
      writeln!(&mut code, "    loading.value = true;")?;
      writeln!(&mut code, "    error.value = null;")?;
      writeln!(&mut code)?;
      writeln!(&mut code, "    try {{")?;
      writeln!(
        &mut code,
        "      const result = await {}.{}({});",
        module_name,
        utils::to_camel_case(&function.name),
        self.generate_reactive_param_list(function)
      )?;
      writeln!(&mut code, "      data.value = result;")?;
      writeln!(&mut code, "    }} catch (err) {{")?;
      writeln!(
        &mut code,
        "      error.value = err{};",
        if typescript { " as Error" } else { "" }
      )?;
      writeln!(&mut code, "    }} finally {{")?;
      writeln!(&mut code, "      loading.value = false;")?;
      writeln!(&mut code, "    }}")?;
      writeln!(&mut code, "  }};")?;
      writeln!(&mut code)?;

      // Auto-fetch on mount
      writeln!(&mut code, "  onMounted(() => {{")?;
      writeln!(&mut code, "    fetch();")?;
      writeln!(&mut code, "  }});")?;
      writeln!(&mut code)?;

      // Watch for parameter changes
      if !function.parameters.is_empty() {
        writeln!(&mut code, "  // Re-fetch when parameters change")?;
        writeln!(&mut code, "  watch(")?;
        writeln!(
          &mut code,
          "    [{}],",
          function
            .parameters
            .iter()
            .map(|p| format!("{}Ref", utils::to_camel_case(&p.name)))
            .collect::<Vec<_>>()
            .join(", ")
        )?;
        writeln!(&mut code, "    () => fetch(),")?;
        writeln!(&mut code, "    {{ immediate: false }}")?;
        writeln!(&mut code, "  );")?;
        writeln!(&mut code)?;
      }

      writeln!(&mut code, "  return {{")?;
      writeln!(&mut code, "    data: computed(() => data.value),")?;
      writeln!(&mut code, "    loading: computed(() => loading.value),")?;
      writeln!(&mut code, "    error: computed(() => error.value),")?;
      writeln!(&mut code, "    refetch: fetch,")?;

      if !function.parameters.is_empty() {
        for param in &function.parameters {
          let param_name = utils::to_camel_case(&param.name);
          writeln!(&mut code, "    {}: {}Ref,", param_name, param_name)?;
        }
      }

      writeln!(&mut code, "  }};")?;
    }

    writeln!(&mut code, "}}")?;

    Ok(code)
  }

  fn generate_mutation_composable(
    &self,
    function: &PactFunction,
    module_name: &str,
    typescript: bool,
  ) -> Result<String> {
    let mut code = String::new();
    let composable_name = utils::to_composable_name(&function.name);

    // Generate JSDoc
    if let Some(doc) = &function.doc {
      writeln!(&mut code, "/**")?;
      writeln!(&mut code, " * {}", doc)?;
      writeln!(
        &mut code,
        " * @returns Reactive mutation state and execute function"
      )?;
      writeln!(&mut code, " */")?;
    }

    writeln!(&mut code, "export function {}() {{", composable_name)?;

    if self.use_vue_query {
      // VueQuery mutation
      writeln!(&mut code, "  const queryClient = useQueryClient();")?;
      writeln!(&mut code)?;
      writeln!(&mut code, "  return useMutation({{")?;
      writeln!(
        &mut code,
        "    mutationFn: ({}) => {}.{}({}),",
        self.generate_mutation_params(function, typescript),
        module_name,
        utils::to_camel_case(&function.name),
        self.generate_param_list(function)
      )?;

      // Add invalidation logic
      writeln!(&mut code, "    onSuccess: () => {{")?;
      writeln!(&mut code, "      // Invalidate related queries")?;

      if function.name.starts_with("create") || function.name.starts_with("add") {
        writeln!(
          &mut code,
          "      queryClient.invalidateQueries({{ queryKey: ['list'] }});"
        )?;
      } else if function.name.starts_with("update") || function.name.starts_with("delete") {
        writeln!(
          &mut code,
          "      queryClient.invalidateQueries({{ queryKey: ['get'] }});"
        )?;
        writeln!(
          &mut code,
          "      queryClient.invalidateQueries({{ queryKey: ['list'] }});"
        )?;
      }

      writeln!(&mut code, "    }},")?;
      writeln!(&mut code, "  }});")?;
    } else {
      // Manual reactive mutation
      writeln!(&mut code, "  const loading = ref(false);")?;
      writeln!(
        &mut code,
        "  const error = ref{}(null);",
        if typescript { "<Error | null>" } else { "" }
      )?;
      writeln!(
        &mut code,
        "  const data = ref{}(null);",
        if typescript { "<any>" } else { "" }
      )?;
      writeln!(&mut code)?;

      writeln!(
        &mut code,
        "  const execute = async ({}) => {{",
        self.generate_mutation_params(function, typescript)
      )?;
      writeln!(&mut code, "    loading.value = true;")?;
      writeln!(&mut code, "    error.value = null;")?;
      writeln!(&mut code)?;
      writeln!(&mut code, "    try {{")?;
      writeln!(
        &mut code,
        "      const result = await {}.{}({});",
        module_name,
        utils::to_camel_case(&function.name),
        self.generate_param_list(function)
      )?;
      writeln!(&mut code, "      data.value = result;")?;
      writeln!(&mut code, "      return result;")?;
      writeln!(&mut code, "    }} catch (err) {{")?;
      writeln!(
        &mut code,
        "      error.value = err{};",
        if typescript { " as Error" } else { "" }
      )?;
      writeln!(&mut code, "      throw err;")?;
      writeln!(&mut code, "    }} finally {{")?;
      writeln!(&mut code, "      loading.value = false;")?;
      writeln!(&mut code, "    }}")?;
      writeln!(&mut code, "  }};")?;
      writeln!(&mut code)?;

      writeln!(&mut code, "  return {{")?;
      writeln!(&mut code, "    execute,")?;
      writeln!(&mut code, "    loading: computed(() => loading.value),")?;
      writeln!(&mut code, "    error: computed(() => error.value),")?;
      writeln!(&mut code, "    data: computed(() => data.value),")?;
      writeln!(&mut code, "  }};")?;
    }

    writeln!(&mut code, "}}")?;

    Ok(code)
  }

  fn generate_module_composable(&self, module: &PactModule, _typescript: bool) -> Result<String> {
    let mut code = String::new();
    let composable_name = format!("use{}", utils::to_pascal_case(&module.name));

    writeln!(&mut code, "/**")?;
    writeln!(
      &mut code,
      " * Combined composable for all {} operations",
      module.name
    )?;
    writeln!(&mut code, " */")?;
    writeln!(&mut code, "export function {}() {{", composable_name)?;
    writeln!(&mut code, "  return {{")?;

    for function in &module.functions {
      let name = utils::to_camel_case(&function.name);
      let composable = utils::to_composable_name(&function.name);
      writeln!(&mut code, "    {}: {},", name, composable)?;
    }

    writeln!(&mut code, "  }};")?;
    writeln!(&mut code, "}}")?;

    Ok(code)
  }

  fn generate_pinia_store(&self, module: &PactModule, typescript: bool) -> Result<String> {
    let mut code = String::new();
    let store_name = utils::to_store_name(&module.name);

    writeln!(&mut code, "import {{ defineStore }} from 'pinia';")?;
    writeln!(&mut code, "import {{ ref, computed }} from 'vue';")?;
    writeln!(
      &mut code,
      "import * as {} from './{}';\n",
      module.name, module.name
    )?;

    writeln!(
      &mut code,
      "export const {} = defineStore('{}', () => {{",
      store_name, module.name
    )?;

    // State
    writeln!(&mut code, "  // State")?;
    writeln!(
      &mut code,
      "  const items = ref{}([]);",
      if typescript { "<any[]>" } else { "" }
    )?;
    writeln!(
      &mut code,
      "  const currentItem = ref{}(null);",
      if typescript { "<any>" } else { "" }
    )?;
    writeln!(&mut code, "  const loading = ref(false);")?;
    writeln!(
      &mut code,
      "  const error = ref{}(null);",
      if typescript { "<Error | null>" } else { "" }
    )?;
    writeln!(&mut code)?;

    // Getters
    writeln!(&mut code, "  // Getters")?;
    writeln!(
      &mut code,
      "  const itemCount = computed(() => items.value.length);"
    )?;
    writeln!(
      &mut code,
      "  const hasItems = computed(() => items.value.length > 0);"
    )?;
    writeln!(
      &mut code,
      "  const isLoading = computed(() => loading.value);"
    )?;
    writeln!(
      &mut code,
      "  const hasError = computed(() => error.value !== null);"
    )?;
    writeln!(&mut code)?;

    // Actions
    writeln!(&mut code, "  // Actions")?;
    let (queries, mutations) = utils::group_functions_by_type(module);

    // Generate query actions
    for function in queries {
      let action_name = utils::to_camel_case(&function.name);
      writeln!(
        &mut code,
        "  async function {}({}) {{",
        action_name,
        self.generate_store_params(function, typescript)
      )?;
      writeln!(&mut code, "    loading.value = true;")?;
      writeln!(&mut code, "    error.value = null;")?;
      writeln!(&mut code, "    try {{")?;
      writeln!(
        &mut code,
        "      const result = await {}.{}({});",
        module.name,
        action_name,
        self.generate_param_list(function)
      )?;

      // Store result based on function type
      if function.name.contains("list") || function.name.contains("get-all") {
        writeln!(&mut code, "      items.value = result;")?;
      } else if function.name.starts_with("get") {
        writeln!(&mut code, "      currentItem.value = result;")?;
      }

      writeln!(&mut code, "      return result;")?;
      writeln!(&mut code, "    }} catch (err) {{")?;
      writeln!(
        &mut code,
        "      error.value = err{};",
        if typescript { " as Error" } else { "" }
      )?;
      writeln!(&mut code, "      throw err;")?;
      writeln!(&mut code, "    }} finally {{")?;
      writeln!(&mut code, "      loading.value = false;")?;
      writeln!(&mut code, "    }}")?;
      writeln!(&mut code, "  }}")?;
      writeln!(&mut code)?;
    }

    // Generate mutation actions
    for function in mutations {
      let action_name = utils::to_camel_case(&function.name);
      writeln!(
        &mut code,
        "  async function {}({}) {{",
        action_name,
        self.generate_store_params(function, typescript)
      )?;
      writeln!(&mut code, "    loading.value = true;")?;
      writeln!(&mut code, "    error.value = null;")?;
      writeln!(&mut code, "    try {{")?;
      writeln!(
        &mut code,
        "      const result = await {}.{}({});",
        module.name,
        action_name,
        self.generate_param_list(function)
      )?;

      // Update store based on mutation type
      if function.name.starts_with("create") || function.name.starts_with("add") {
        writeln!(&mut code, "      items.value.push(result);")?;
      } else if function.name.starts_with("update") {
        writeln!(
          &mut code,
          "      const index = items.value.findIndex(item => item.id === result.id);"
        )?;
        writeln!(&mut code, "      if (index !== -1) {{")?;
        writeln!(&mut code, "        items.value[index] = result;")?;
        writeln!(&mut code, "      }}")?;
      } else if function.name.starts_with("delete") || function.name.starts_with("remove") {
        writeln!(
          &mut code,
          "      items.value = items.value.filter(item => item.id !== result.id);"
        )?;
      }

      writeln!(&mut code, "      return result;")?;
      writeln!(&mut code, "    }} catch (err) {{")?;
      writeln!(
        &mut code,
        "      error.value = err{};",
        if typescript { " as Error" } else { "" }
      )?;
      writeln!(&mut code, "      throw err;")?;
      writeln!(&mut code, "    }} finally {{")?;
      writeln!(&mut code, "      loading.value = false;")?;
      writeln!(&mut code, "    }}")?;
      writeln!(&mut code, "  }}")?;
      writeln!(&mut code)?;
    }

    // Reset function
    writeln!(&mut code, "  function reset() {{")?;
    writeln!(&mut code, "    items.value = [];")?;
    writeln!(&mut code, "    currentItem.value = null;")?;
    writeln!(&mut code, "    loading.value = false;")?;
    writeln!(&mut code, "    error.value = null;")?;
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code)?;

    // Return store interface
    writeln!(&mut code, "  return {{")?;
    writeln!(&mut code, "    // State")?;
    writeln!(&mut code, "    items,")?;
    writeln!(&mut code, "    currentItem,")?;
    writeln!(&mut code, "    loading,")?;
    writeln!(&mut code, "    error,")?;
    writeln!(&mut code, "    // Getters")?;
    writeln!(&mut code, "    itemCount,")?;
    writeln!(&mut code, "    hasItems,")?;
    writeln!(&mut code, "    isLoading,")?;
    writeln!(&mut code, "    hasError,")?;
    writeln!(&mut code, "    // Actions")?;

    for function in &module.functions {
      writeln!(&mut code, "    {},", utils::to_camel_case(&function.name))?;
    }

    writeln!(&mut code, "    reset,")?;
    writeln!(&mut code, "  }};")?;
    writeln!(&mut code, "}});")?;

    Ok(code)
  }

  fn generate_composable_params(&self, function: &PactFunction, typescript: bool) -> String {
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

  fn generate_store_params(&self, function: &PactFunction, typescript: bool) -> String {
    self.generate_composable_params(function, typescript)
  }

  fn generate_mutation_params(&self, function: &PactFunction, typescript: bool) -> String {
    if function.parameters.is_empty() {
      String::new()
    } else if function.parameters.len() == 1 {
      let p = &function.parameters[0];
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
    } else {
      // For multiple params, use object destructuring
      let params = function
        .parameters
        .iter()
        .map(|p| utils::to_camel_case(&p.name))
        .collect::<Vec<_>>()
        .join(", ");
      format!("{{ {} }}", params)
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

  fn generate_param_refs(&self, function: &PactFunction) -> String {
    function
      .parameters
      .iter()
      .map(|p| format!("{}.value", utils::to_camel_case(&p.name)))
      .collect::<Vec<_>>()
      .join(", ")
  }

  fn generate_reactive_param_list(&self, function: &PactFunction) -> String {
    function
      .parameters
      .iter()
      .map(|p| format!("{}Ref.value", utils::to_camel_case(&p.name)))
      .collect::<Vec<_>>()
      .join(", ")
  }

  fn generate_query_key(&self, function: &PactFunction) -> String {
    let mut parts = vec![format!("'{}'", function.name)];

    for param in &function.parameters {
      parts.push(format!("{}.value", utils::to_camel_case(&param.name)));
    }

    parts.join(", ")
  }
}

impl FrameworkGenerator for VueGenerator {
  fn name(&self) -> &'static str {
    "vue"
  }

  fn supported_patterns(&self) -> Vec<&'static str> {
    vec![
      "composables",
      "stores",
      "pinia",
      "vue-query",
      "composition-api",
    ]
  }

  fn generate(&self, modules: &[PactModule], options: &CodeGenOptions) -> Result<GeneratedCode> {
    let typescript = options.typescript.unwrap_or(true);
    let mut additional_files = Vec::new();

    // Generate composables
    let composables_code = self.generate_composables(modules, typescript)?;

    // Generate Pinia stores if requested
    if self.generate_stores
      || options.patterns.contains(&"stores".to_string())
      || options.patterns.contains(&"pinia".to_string())
    {
      for module in modules {
        additional_files.push(AdditionalFile {
          name: format!(
            "{}.store.{}",
            module.name,
            if typescript { "ts" } else { "js" }
          ),
          content: self.generate_pinia_store(module, typescript)?,
          description: Some(format!("Pinia store for {} module", module.name)),
        });
      }
    }

    // Prepare imports
    let mut imports = vec![];

    if self.vue_version == 3 {
      imports.push("import { createApp } from 'vue';".to_string());
    } else {
      imports.push("import Vue from 'vue';".to_string());
      imports.push("import VueCompositionAPI from '@vue/composition-api';".to_string());
    }

    if self.use_vue_query {
      imports.push("import { VueQueryPlugin } from '@tanstack/vue-query';".to_string());
    }

    if self.generate_stores {
      imports.push("import { createPinia } from 'pinia';".to_string());
    }

    // Prepare exports
    let exports = modules
      .iter()
      .flat_map(|module| {
        let mut module_exports = vec![];

        // Export individual composables
        for function in &module.functions {
          module_exports.push(format!(
            "export {{ {} }};",
            utils::to_composable_name(&function.name)
          ));
        }

        // Export combined module composable
        module_exports.push(format!(
          "export {{ use{} }};",
          utils::to_pascal_case(&module.name)
        ));

        module_exports
      })
      .collect();

    Ok(GeneratedCode {
      code: composables_code,
      types: None, // Types are embedded in TypeScript files
      additional_files,
      imports,
      exports,
    })
  }

  fn file_extension(&self, typescript: bool) -> &'static str {
    if typescript {
      "composables.ts"
    } else {
      "composables.js"
    }
  }
}

impl Default for VueGenerator {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::ast::{PactFunction, PactParameter};

  #[test]
  fn test_vue_generator_creation() {
    let generator = VueGenerator::new();
    assert_eq!(generator.name(), "vue");
    assert!(generator.supported_patterns().contains(&"composables"));
  }

  #[test]
  fn test_composable_generation() {
    let generator = VueGenerator::new();

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

    assert!(result.code.contains("useGetUser"));
    assert!(result.code.contains("ref"));
    assert!(result.code.contains("computed"));
  }
}
