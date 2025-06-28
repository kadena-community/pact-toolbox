use super::{utils, AdditionalFile, CodeGenOptions, FrameworkGenerator, GeneratedCode};
use crate::ast::{PactFunction, PactModule};
use crate::types::pact_type_to_typescript;
use anyhow::Result;
use std::fmt::Write;

/// React-specific code generator
pub struct ReactGenerator {
  /// Use React Query for data fetching
  use_react_query: bool,
  /// Use SWR for data fetching
  use_swr: bool,
  /// Generate error boundaries
  generate_error_boundaries: bool,
  /// Generate suspense wrappers
  generate_suspense: bool,
}

impl ReactGenerator {
  pub fn new() -> Self {
    Self {
      use_react_query: true,
      use_swr: false,
      generate_error_boundaries: true,
      generate_suspense: true,
    }
  }

  fn generate_hooks(&self, modules: &[PactModule], typescript: bool) -> Result<String> {
    let mut hooks = String::new();

    // Add imports
    hooks.push_str("import { useState, useEffect, useCallback, useMemo } from 'react';\n");

    if self.use_react_query {
      hooks.push_str(
        "import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\n",
      );
    } else if self.use_swr {
      hooks.push_str("import useSWR from 'swr';\n");
      hooks.push_str("import useSWRMutation from 'swr/mutation';\n");
    }

    // Import generated Pact functions
    for module in modules {
      hooks.push_str(&format!(
        "import * as {} from './{}';\n",
        module.name, module.name
      ));
    }

    hooks.push_str("\n");

    // Generate hooks for each module
    for module in modules {
      hooks.push_str(&self.generate_module_hooks(module, typescript)?);
    }

    Ok(hooks)
  }

  fn generate_module_hooks(&self, module: &PactModule, typescript: bool) -> Result<String> {
    let mut code = String::new();

    // Add module comment
    writeln!(&mut code, "// Hooks for {} module", module.name)?;
    writeln!(&mut code)?;

    let (queries, mutations) = utils::group_functions_by_type(module);

    // Generate query hooks
    for function in queries {
      code.push_str(&self.generate_query_hook(function, &module.name, typescript)?);
      code.push('\n');
    }

    // Generate mutation hooks
    for function in mutations {
      code.push_str(&self.generate_mutation_hook(function, &module.name, typescript)?);
      code.push('\n');
    }

    Ok(code)
  }

  fn generate_query_hook(
    &self,
    function: &PactFunction,
    module_name: &str,
    typescript: bool,
  ) -> Result<String> {
    let mut code = String::new();
    let hook_name = utils::to_hook_name(&function.name);

    // Generate JSDoc
    if let Some(doc) = &function.doc {
      writeln!(&mut code, "/**")?;
      writeln!(&mut code, " * {}", doc)?;
      writeln!(
        &mut code,
        " * @returns Query result with data, loading, and error states"
      )?;
      writeln!(&mut code, " */")?;
    }

    // Generate function signature
    let params = self.generate_hook_params(function, typescript);
    let options_param = if typescript {
      ", options?: QueryOptions"
    } else {
      ", options"
    };

    writeln!(
      &mut code,
      "export function {}({}{}) {{",
      hook_name, params, options_param
    )?;

    if self.use_react_query {
      // React Query implementation
      let query_key = self.generate_query_key(function);
      let query_fn = format!("{}.{}", module_name, utils::to_camel_case(&function.name));

      writeln!(&mut code, "  return useQuery({{")?;
      writeln!(&mut code, "    queryKey: [{}],", query_key)?;
      writeln!(
        &mut code,
        "    queryFn: () => {}({}),",
        query_fn,
        self.generate_param_list(function)
      )?;

      if function.name.contains("list") || function.name.contains("get-all") {
        writeln!(&mut code, "    staleTime: 5 * 60 * 1000, // 5 minutes")?;
      }

      writeln!(&mut code, "    ...options,")?;
      writeln!(&mut code, "  }});")?;
    } else if self.use_swr {
      // SWR implementation
      let key = self.generate_swr_key(function);
      let fetcher = format!(
        "() => {}.{}({})",
        module_name,
        utils::to_camel_case(&function.name),
        self.generate_param_list(function)
      );

      writeln!(&mut code, "  return useSWR(")?;
      writeln!(&mut code, "    {},", key)?;
      writeln!(&mut code, "    {},", fetcher)?;
      writeln!(&mut code, "    options")?;
      writeln!(&mut code, "  );")?;
    } else {
      // Manual implementation
      writeln!(&mut code, "  const [data, setData] = useState(null);")?;
      writeln!(&mut code, "  const [loading, setLoading] = useState(true);")?;
      writeln!(&mut code, "  const [error, setError] = useState(null);")?;
      writeln!(&mut code)?;
      writeln!(&mut code, "  useEffect(() => {{")?;
      writeln!(&mut code, "    let cancelled = false;")?;
      writeln!(&mut code)?;
      writeln!(&mut code, "    const fetchData = async () => {{")?;
      writeln!(&mut code, "      try {{")?;
      writeln!(&mut code, "        setLoading(true);")?;
      writeln!(
        &mut code,
        "        const result = await {}.{}({});",
        module_name,
        utils::to_camel_case(&function.name),
        self.generate_param_list(function)
      )?;
      writeln!(&mut code, "        if (!cancelled) {{")?;
      writeln!(&mut code, "          setData(result);")?;
      writeln!(&mut code, "          setError(null);")?;
      writeln!(&mut code, "        }}")?;
      writeln!(&mut code, "      }} catch (err) {{")?;
      writeln!(&mut code, "        if (!cancelled) {{")?;
      writeln!(&mut code, "          setError(err);")?;
      writeln!(&mut code, "          setData(null);")?;
      writeln!(&mut code, "        }}")?;
      writeln!(&mut code, "      }} finally {{")?;
      writeln!(&mut code, "        if (!cancelled) {{")?;
      writeln!(&mut code, "          setLoading(false);")?;
      writeln!(&mut code, "        }}")?;
      writeln!(&mut code, "      }}")?;
      writeln!(&mut code, "    }};")?;
      writeln!(&mut code)?;
      writeln!(&mut code, "    fetchData();")?;
      writeln!(&mut code)?;
      writeln!(&mut code, "    return () => {{")?;
      writeln!(&mut code, "      cancelled = true;")?;
      writeln!(&mut code, "    }};")?;
      writeln!(
        &mut code,
        "  }}, [{}]);",
        self.generate_dependency_array(function)
      )?;
      writeln!(&mut code)?;
      writeln!(&mut code, "  return {{ data, loading, error }};")?;
    }

    writeln!(&mut code, "}}")?;

    Ok(code)
  }

  fn generate_mutation_hook(
    &self,
    function: &PactFunction,
    module_name: &str,
    typescript: bool,
  ) -> Result<String> {
    let mut code = String::new();
    let hook_name = utils::to_hook_name(&function.name);

    // Generate JSDoc
    if let Some(doc) = &function.doc {
      writeln!(&mut code, "/**")?;
      writeln!(&mut code, " * {}", doc)?;
      writeln!(
        &mut code,
        " * @returns Mutation function with loading and error states"
      )?;
      writeln!(&mut code, " */")?;
    }

    let options_param = if typescript {
      "options?: MutationOptions"
    } else {
      "options"
    };

    writeln!(
      &mut code,
      "export function {}({}) {{",
      hook_name, options_param
    )?;

    if self.use_react_query {
      // React Query mutation
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
      writeln!(&mut code, "    ...options,")?;
      writeln!(&mut code, "  }});")?;
    } else if self.use_swr {
      // SWR mutation
      writeln!(&mut code, "  return useSWRMutation(")?;
      writeln!(&mut code, "    '{}',", function.name)?;
      writeln!(
        &mut code,
        "    (key, {{ arg }}) => {}.{}(arg),",
        module_name,
        utils::to_camel_case(&function.name)
      )?;
      writeln!(&mut code, "    options")?;
      writeln!(&mut code, "  );")?;
    } else {
      // Manual mutation implementation
      writeln!(
        &mut code,
        "  const [loading, setLoading] = useState(false);"
      )?;
      writeln!(&mut code, "  const [error, setError] = useState(null);")?;
      writeln!(&mut code)?;
      writeln!(
        &mut code,
        "  const mutate = useCallback(async ({}) => {{",
        self.generate_mutation_params(function, typescript)
      )?;
      writeln!(&mut code, "    setLoading(true);")?;
      writeln!(&mut code, "    setError(null);")?;
      writeln!(&mut code)?;
      writeln!(&mut code, "    try {{")?;
      writeln!(
        &mut code,
        "      const result = await {}.{}({});",
        module_name,
        utils::to_camel_case(&function.name),
        self.generate_param_list(function)
      )?;
      writeln!(&mut code, "      return result;")?;
      writeln!(&mut code, "    }} catch (err) {{")?;
      writeln!(&mut code, "      setError(err);")?;
      writeln!(&mut code, "      throw err;")?;
      writeln!(&mut code, "    }} finally {{")?;
      writeln!(&mut code, "      setLoading(false);")?;
      writeln!(&mut code, "    }}")?;
      writeln!(&mut code, "  }}, []);")?;
      writeln!(&mut code)?;
      writeln!(&mut code, "  return {{")?;
      writeln!(&mut code, "    mutate,")?;
      writeln!(&mut code, "    loading,")?;
      writeln!(&mut code, "    error,")?;
      writeln!(&mut code, "  }};")?;
    }

    writeln!(&mut code, "}}")?;

    Ok(code)
  }

  fn generate_hook_params(&self, function: &PactFunction, typescript: bool) -> String {
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

  fn generate_query_key(&self, function: &PactFunction) -> String {
    let mut parts = vec![format!("'{}'", function.name)];

    for param in &function.parameters {
      parts.push(utils::to_camel_case(&param.name));
    }

    parts.join(", ")
  }

  fn generate_swr_key(&self, function: &PactFunction) -> String {
    if function.parameters.is_empty() {
      format!("'{}'", function.name)
    } else {
      let params = function
        .parameters
        .iter()
        .map(|p| format!("${{{}}}", utils::to_camel_case(&p.name)))
        .collect::<Vec<_>>()
        .join("-");
      format!("`{}-{}`", function.name, params)
    }
  }

  fn generate_dependency_array(&self, function: &PactFunction) -> String {
    function
      .parameters
      .iter()
      .map(|p| utils::to_camel_case(&p.name))
      .collect::<Vec<_>>()
      .join(", ")
  }

  fn generate_error_boundary(&self, typescript: bool) -> Result<String> {
    let mut code = String::new();

    writeln!(&mut code, "import React from 'react';")?;
    writeln!(&mut code)?;

    if typescript {
      writeln!(&mut code, "interface ErrorBoundaryState {{")?;
      writeln!(&mut code, "  hasError: boolean;")?;
      writeln!(&mut code, "  error: Error | null;")?;
      writeln!(&mut code, "}}")?;
      writeln!(&mut code)?;
      writeln!(&mut code, "interface ErrorBoundaryProps {{")?;
      writeln!(&mut code, "  children: React.ReactNode;")?;
      writeln!(&mut code, "  fallback?: (error: Error) => React.ReactNode;")?;
      writeln!(&mut code, "}}")?;
      writeln!(&mut code)?;
    }

    writeln!(
      &mut code,
      "export class PactErrorBoundary extends React.Component{} {{",
      if typescript {
        "<ErrorBoundaryProps, ErrorBoundaryState>"
      } else {
        ""
      }
    )?;
    writeln!(
      &mut code,
      "  constructor(props{}) {{",
      if typescript {
        ": ErrorBoundaryProps"
      } else {
        ""
      }
    )?;
    writeln!(&mut code, "    super(props);")?;
    writeln!(
      &mut code,
      "    this.state = {{ hasError: false, error: null }};"
    )?;
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code)?;
    writeln!(
      &mut code,
      "  static getDerivedStateFromError(error{}) {{",
      if typescript { ": Error" } else { "" }
    )?;
    writeln!(&mut code, "    return {{ hasError: true, error }};")?;
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code)?;
    writeln!(
      &mut code,
      "  componentDidCatch(error{}, errorInfo{}) {{",
      if typescript { ": Error" } else { "" },
      if typescript { ": React.ErrorInfo" } else { "" }
    )?;
    writeln!(
      &mut code,
      "    console.error('Pact Error:', error, errorInfo);"
    )?;
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code)?;
    writeln!(&mut code, "  render() {{")?;
    writeln!(&mut code, "    if (this.state.hasError) {{")?;
    writeln!(&mut code, "      if (this.props.fallback) {{")?;
    writeln!(
      &mut code,
      "        return this.props.fallback(this.state.error!);"
    )?;
    writeln!(&mut code, "      }}")?;
    writeln!(&mut code, "      return (")?;
    writeln!(
      &mut code,
      "        <div style={{{{ padding: '20px', color: 'red' }}}}>"
    )?;
    writeln!(&mut code, "          <h2>Something went wrong</h2>")?;
    writeln!(&mut code, "          <details>")?;
    writeln!(&mut code, "            <summary>Error details</summary>")?;
    writeln!(
      &mut code,
      "            <pre>{{this.state.error?.toString()}}</pre>"
    )?;
    writeln!(&mut code, "          </details>")?;
    writeln!(&mut code, "        </div>")?;
    writeln!(&mut code, "      );")?;
    writeln!(&mut code, "    }}")?;
    writeln!(&mut code)?;
    writeln!(&mut code, "    return this.props.children;")?;
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code, "}}")?;

    Ok(code)
  }

  fn generate_suspense_wrapper(&self, typescript: bool) -> Result<String> {
    let mut code = String::new();

    writeln!(&mut code, "import React, {{ Suspense }} from 'react';")?;
    writeln!(&mut code)?;

    if typescript {
      writeln!(&mut code, "interface PactSuspenseProps {{")?;
      writeln!(&mut code, "  children: React.ReactNode;")?;
      writeln!(&mut code, "  fallback?: React.ReactNode;")?;
      writeln!(&mut code, "}}")?;
      writeln!(&mut code)?;
    }

    writeln!(
      &mut code,
      "export function PactSuspense({{ children, fallback = <div>Loading...</div> }}{}) {{",
      if typescript {
        ": PactSuspenseProps"
      } else {
        ""
      }
    )?;
    writeln!(&mut code, "  return (")?;
    writeln!(&mut code, "    <Suspense fallback={{fallback}}>")?;
    writeln!(&mut code, "      {{children}}")?;
    writeln!(&mut code, "    </Suspense>")?;
    writeln!(&mut code, "  );")?;
    writeln!(&mut code, "}}")?;

    Ok(code)
  }
}

impl FrameworkGenerator for ReactGenerator {
  fn name(&self) -> &'static str {
    "react"
  }

  fn supported_patterns(&self) -> Vec<&'static str> {
    vec![
      "hooks",
      "error-boundaries",
      "suspense",
      "react-query",
      "swr",
    ]
  }

  fn generate(&self, modules: &[PactModule], options: &CodeGenOptions) -> Result<GeneratedCode> {
    let typescript = options.typescript.unwrap_or(true);
    let mut additional_files = Vec::new();

    // Generate hooks
    let hooks_code = self.generate_hooks(modules, typescript)?;

    // Generate error boundary if requested
    if self.generate_error_boundaries || options.patterns.contains(&"error-boundaries".to_string())
    {
      additional_files.push(AdditionalFile {
        name: format!(
          "PactErrorBoundary.{}",
          if typescript { "tsx" } else { "jsx" }
        ),
        content: self.generate_error_boundary(typescript)?,
        description: Some("Error boundary component for Pact operations".to_string()),
      });
    }

    // Generate suspense wrapper if requested
    if self.generate_suspense || options.patterns.contains(&"suspense".to_string()) {
      additional_files.push(AdditionalFile {
        name: format!("PactSuspense.{}", if typescript { "tsx" } else { "jsx" }),
        content: self.generate_suspense_wrapper(typescript)?,
        description: Some("Suspense wrapper for Pact data fetching".to_string()),
      });
    }

    // Prepare imports
    let mut imports = vec!["import React from 'react';".to_string()];

    if self.use_react_query {
      imports.push(
        "import { QueryClient, QueryClientProvider } from '@tanstack/react-query';".to_string(),
      );
    } else if self.use_swr {
      imports.push("import { SWRConfig } from 'swr';".to_string());
    }

    // Prepare exports
    let exports = modules
      .iter()
      .flat_map(|module| {
        module
          .functions
          .iter()
          .map(|f| format!("export {{ {} }};", utils::to_hook_name(&f.name)))
          .collect::<Vec<_>>()
      })
      .collect();

    Ok(GeneratedCode {
      code: hooks_code,
      types: None, // Types are embedded in TypeScript files
      additional_files,
      imports,
      exports,
    })
  }

  fn file_extension(&self, typescript: bool) -> &'static str {
    if typescript {
      "hooks.ts"
    } else {
      "hooks.js"
    }
  }
}

impl Default for ReactGenerator {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::ast::{PactFunction, PactParameter};

  #[test]
  fn test_react_generator_creation() {
    let generator = ReactGenerator::new();
    assert_eq!(generator.name(), "react");
    assert!(generator.supported_patterns().contains(&"hooks"));
  }

  #[test]
  fn test_hook_generation() {
    let generator = ReactGenerator::new();

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
    assert!(result.code.contains("useQuery"));
  }
}
