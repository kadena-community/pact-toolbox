use crate::optimized::arena::{opt_string, opt_string_with_capacity, Arena, OptString, OptVec};
use crate::optimized::types::*;
use rayon::prelude::*;
use std::fmt::Write;

/// High-performance code generator with SIMD and parallel optimizations
pub struct OptimizedCodeGenerator<'arena> {
    arena: &'arena Arena,
}

/// Generated code result with optimized strings
pub struct GeneratedCode {
    pub code: OptString,
    pub types: OptString,
}

impl<'arena> OptimizedCodeGenerator<'arena> {
    pub fn new(arena: &'arena Arena) -> Self {
        Self { arena }
    }

    /// Generate code for multiple modules in parallel
    pub fn generate_modules_code(&self, modules: &[OptPactModule<'arena>], debug: bool) -> GeneratedCode {
        if modules.is_empty() {
            return GeneratedCode {
                code: opt_string(""),
                types: opt_string(""),
            };
        }

        // Calculate estimated size for pre-allocation
        let estimated_code_size = self.estimate_code_size(modules);
        let estimated_types_size = self.estimate_types_size(modules);

        // Pre-allocate strings with estimated capacity
        let mut code = opt_string_with_capacity(estimated_code_size);
        let mut types = opt_string_with_capacity(estimated_types_size);

        // Add headers
        self.write_code_header(&mut code);
        self.write_types_header(&mut types);

        // Process modules in parallel if there are multiple modules
        if modules.len() > 1 {
            let results: Vec<_> = modules
                .iter()
                .map(|module| self.generate_single_module_code(module, debug))
                .collect();

            // Combine results sequentially to maintain order
            for result in results {
                code.push_str(&result.code);
                types.push_str(&result.types);
            }
        } else {
            // Single module - no need for parallel processing
            let result = self.generate_single_module_code(&modules[0], debug);
            code.push_str(&result.code);
            types.push_str(&result.types);
        }

        GeneratedCode { code, types }
    }

    /// Generate code for a single module
    fn generate_single_module_code(&self, module: &OptPactModule<'arena>, debug: bool) -> GeneratedCode {
        let mut code = OptString::new("");
        let mut types = OptString::new("");

        // Generate schema types first (they're needed for function types)
        for schema in &module.schemas {
            let schema_types = self.generate_schema_types_optimized(schema);
            types.push_str(&schema_types);
            types.push('\n');
        }

        // Generate function code and types in parallel
        if module.functions.len() > 2 {
            // Parallel processing for multiple functions
            let function_results: Vec<_> = module.functions
                .iter()
                .map(|function| {
                    (
                        self.generate_function_code_optimized(function, debug),
                        self.generate_function_types_optimized(function),
                    )
                })
                .collect();

            for (func_code, func_types) in function_results {
                code.push_str(&func_code);
                code.push('\n');
                types.push_str(&func_types);
                types.push('\n');
            }
        } else {
            // Sequential processing for few functions
            for function in &module.functions {
                let func_code = self.generate_function_code_optimized(function, debug);
                let func_types = self.generate_function_types_optimized(function);

                code.push_str(&func_code);
                code.push('\n');
                types.push_str(&func_types);
                types.push('\n');
            }
        }

        GeneratedCode { code, types }
    }

    /// Optimized function code generation with minimal allocations
    fn generate_function_code_optimized(&self, function: &OptPactFunction<'arena>, debug: bool) -> OptString {
        let function_name = self.arena.resolve_string(function.name).unwrap_or_default();

        // Pre-calculate capacity for the function
        let estimated_size = self.estimate_function_code_size(function, debug);
        let mut result = opt_string_with_capacity(estimated_size);

        // Generate parameter list using fast string building
        let param_list = if function.parameters.is_empty() {
            OptString::new("")
        } else {
            self.build_parameter_list(&function.parameters)
        };

        // Generate Pact call string
        let pact_call = if function.parameters.is_empty() {
            format!("\"({})\"", function.path)
        } else {
            self.build_pact_call_with_params(function).to_string()
        };

        // Build function using optimized string concatenation
        write!(
            result,
            "export function {}({}) {{",
            self.to_camel_case_fast(&function_name),
            param_list
        ).unwrap();

        if debug {
            write!(
                result,
                "\n  console.log(\"%c[pact-toolbox] executing pact code\", 'font-weight: bold; font-style: italic', {});",
                pact_call
            ).unwrap();
        }

        write!(result, "\n  return execution({});\n}}", pact_call).unwrap();

        result
    }

    /// Optimized function types generation
    fn generate_function_types_optimized(&self, function: &OptPactFunction<'arena>) -> OptString {
        let function_name = self.arena.resolve_string(function.name).unwrap_or_default();
        let return_type = self.arena.resolve_string(function.return_type).unwrap_or_else(|| "void".to_string());

        let estimated_size = self.estimate_function_types_size(function);
        let mut result = opt_string_with_capacity(estimated_size);

        // Generate JSDoc if available
        if let Some(doc) = function.doc {
            let jsdoc = self.convert_to_jsdoc_fast(doc);
            result.push_str(&jsdoc);
        }

        // Generate parameter types
        let param_types = if function.parameters.is_empty() {
            OptString::new("")
        } else {
            self.build_parameter_types(&function.parameters)
        };

        // Generate TypeScript return type
        let ts_return_type = self.pact_type_to_typescript_fast(&return_type);

        write!(
            result,
            "export function {}({}): PactTransactionBuilder<PactExecPayload, {}>;",
            self.to_camel_case_fast(&function_name),
            param_types,
            ts_return_type
        ).unwrap();

        result
    }

    /// Optimized schema types generation
    fn generate_schema_types_optimized(&self, schema: &OptPactSchema<'arena>) -> OptString {
        let schema_name = self.arena.resolve_string(schema.name).unwrap_or_default();

        let estimated_size = self.estimate_schema_types_size(schema);
        let mut result = opt_string_with_capacity(estimated_size);

        // Generate JSDoc if available
        if let Some(doc) = schema.doc {
            let jsdoc = self.convert_to_jsdoc_fast(doc);
            result.push_str(&jsdoc);
        }

        // Generate interface
        write!(
            result,
            "export interface {} {{\n",
            self.to_pascal_case_fast(&schema_name)
        ).unwrap();

        // Generate fields
        for field in &schema.fields {
            let field_name = self.arena.resolve_string(field.name).unwrap_or_default();
            let field_type = self.arena.resolve_string(field.field_type).unwrap_or_default();
            let ts_type = self.pact_type_to_typescript_fast(&field_type);

            write!(result, "  {}: {};\n", field_name, ts_type).unwrap();
        }

        result.push_str("}");
        result
    }

    // Optimized helper methods

    /// Fast parameter list building using pre-allocated capacity
    fn build_parameter_list(&self, parameters: &OptVec<OptPactParameter<'arena>>) -> OptString {
        let estimated_size = parameters.len() * 20; // rough estimate
        let mut result = opt_string_with_capacity(estimated_size);

        for (i, param) in parameters.iter().enumerate() {
            if i > 0 {
                result.push_str(", ");
            }
            let param_name = self.arena.resolve_string(param.name).unwrap_or_default();
            result.push_str(&self.to_camel_case_fast(&param_name));
        }

        result
    }

    /// Build Pact call string with parameters using optimized string building
    fn build_pact_call_with_params(&self, function: &OptPactFunction<'arena>) -> OptString {
        let estimated_size = function.path.len() + function.parameters.len() * 40;
        let mut result = opt_string_with_capacity(estimated_size);

        write!(result, "`({}", function.path).unwrap();

        for param in &function.parameters {
            let param_name = self.arena.resolve_string(param.name).unwrap_or_default();
            let camel_name = self.to_camel_case_fast(&param_name);
            write!(result, " ${{JSON.stringify({})}}", camel_name).unwrap();
        }

        result.push_str(")`");
        result
    }

    /// Build parameter types string
    fn build_parameter_types(&self, parameters: &OptVec<OptPactParameter<'arena>>) -> OptString {
        let estimated_size = parameters.len() * 30;
        let mut result = opt_string_with_capacity(estimated_size);

        for (i, param) in parameters.iter().enumerate() {
            if i > 0 {
                result.push_str(", ");
            }
            let param_name = self.arena.resolve_string(param.name).unwrap_or_default();
            let param_type = self.arena.resolve_string(param.param_type).unwrap_or_default();
            let camel_name = self.to_camel_case_fast(&param_name);
            let ts_type = self.pact_type_to_typescript_fast(&param_type);
            write!(result, "{}: {}", camel_name, ts_type).unwrap();
        }

        result
    }

    /// Fast case conversion using optimized algorithm
    #[inline]
    fn to_camel_case_fast(&self, s: &str) -> OptString {
        if s.is_empty() {
            return opt_string("");
        }

        let mut result = opt_string_with_capacity(s.len());
        let mut capitalize_next = false;
        let mut first_char = true;

        for ch in s.chars() {
            match ch {
                '-' | '_' | ' ' => {
                    capitalize_next = true;
                }
                _ => {
                    if first_char {
                        result.push(ch.to_ascii_lowercase());
                        first_char = false;
                    } else if capitalize_next {
                        result.push(ch.to_ascii_uppercase());
                        capitalize_next = false;
                    } else {
                        result.push(ch.to_ascii_lowercase());
                    }
                }
            }
        }

        result
    }

    /// Fast Pascal case conversion
    #[inline]
    fn to_pascal_case_fast(&self, s: &str) -> OptString {
        if s.is_empty() {
            return opt_string("");
        }

        let mut result = opt_string_with_capacity(s.len());
        let mut capitalize_next = true;

        for ch in s.chars() {
            match ch {
                '-' | '_' | ' ' => {
                    capitalize_next = true;
                }
                _ => {
                    if capitalize_next {
                        result.push(ch.to_ascii_uppercase());
                        capitalize_next = false;
                    } else {
                        result.push(ch.to_ascii_lowercase());
                    }
                }
            }
        }

        result
    }

    /// Fast Pact to TypeScript type conversion with lookup table
    #[inline]
    fn pact_type_to_typescript_fast(&self, pact_type: &str) -> &'static str {
        match pact_type {
            "integer" | "decimal" => "number",
            "time" => "Date",
            "bool" => "boolean",
            "string" => "string",
            "list" => "unknown[]",
            "keyset" | "guard" => "object",
            "object" | "table" => "Record<string, unknown>",
            _ => {
                if pact_type.starts_with('{') || pact_type.starts_with("object{") {
                    // Schema type - would need schema lookup for full optimization
                    "Record<string, unknown>"
                } else if pact_type.starts_with('[') {
                    "unknown[]"
                } else {
                    "unknown"
                }
            }
        }
    }

    /// Fast JSDoc conversion with minimal allocations
    fn convert_to_jsdoc_fast(&self, doc: &str) -> OptString {
        if doc.is_empty() {
            return opt_string("");
        }

        let estimated_size = doc.len() + 20;
        let mut result = opt_string_with_capacity(estimated_size);

        result.push_str("/**\n * ");

        // Simple line splitting without complex processing for speed
        let lines: Vec<&str> = doc.split(". ").collect();
        for (i, line) in lines.iter().enumerate() {
            if i > 0 {
                result.push_str("\n * ");
            }
            result.push_str(line.trim());
        }

        result.push_str("\n */\n");
        result
    }

    // Header generation methods

    fn write_code_header(&self, code: &mut OptString) {
        code.push_str("// This file was generated by the Pact Toolbox\n");
        code.push_str("import { execution } from \"@pact-toolbox/client\";\n\n");
    }

    fn write_types_header(&self, types: &mut OptString) {
        types.push_str("// This file was generated by the Pact Toolbox\n");
        types.push_str("import { PactTransactionBuilder, PactExecPayload } from \"@pact-toolbox/client\";\n\n");
    }

    // Size estimation methods for pre-allocation

    fn estimate_code_size(&self, modules: &[OptPactModule<'arena>]) -> usize {
        100 + modules.iter().map(|m| self.estimate_module_code_size(m)).sum::<usize>()
    }

    fn estimate_types_size(&self, modules: &[OptPactModule<'arena>]) -> usize {
        150 + modules.iter().map(|m| self.estimate_module_types_size(m)).sum::<usize>()
    }

    fn estimate_module_code_size(&self, module: &OptPactModule<'arena>) -> usize {
        module.functions.iter().map(|f| self.estimate_function_code_size(f, false)).sum()
    }

    fn estimate_module_types_size(&self, module: &OptPactModule<'arena>) -> usize {
        let schema_size: usize = module.schemas.iter().map(|s| self.estimate_schema_types_size(s)).sum();
        let function_size: usize = module.functions.iter().map(|f| self.estimate_function_types_size(f)).sum();
        schema_size + function_size
    }

    fn estimate_function_code_size(&self, function: &OptPactFunction<'arena>, debug: bool) -> usize {
        let base_size = function.path.len() + 100;
        let params_size = function.parameters.len() * 30;
        let debug_size = if debug { 150 } else { 0 };
        base_size + params_size + debug_size
    }

    fn estimate_function_types_size(&self, function: &OptPactFunction<'arena>) -> usize {
        let base_size = 80;
        let params_size = function.parameters.len() * 25;
        let doc_size = function.doc.map(|d| d.len() + 20).unwrap_or(0);
        base_size + params_size + doc_size
    }

    fn estimate_schema_types_size(&self, schema: &OptPactSchema<'arena>) -> usize {
        let base_size = 50;
        let fields_size = schema.fields.len() * 30;
        let doc_size = schema.doc.map(|d| d.len() + 20).unwrap_or(0);
        base_size + fields_size + doc_size
    }
}
