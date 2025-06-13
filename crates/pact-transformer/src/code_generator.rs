use crate::ast::*;
use crate::error::TransformResult;
use crate::types::{convert_to_jsdoc, pact_type_to_typescript};
use rayon::prelude::*;
use std::fmt::Write;

pub struct CodeGenerator {
    generate_types: bool,
}

/// Generate JavaScript code from modules
#[allow(dead_code)]
pub fn generate_js(modules: &[PactModule]) -> String {
    let mut generator = CodeGenerator::new(false);
    match generator.generate(modules) {
        Ok((code, _)) => code,
        Err(_) => String::new(),
    }
}

/// Generate TypeScript types from modules
#[allow(dead_code)]
pub fn generate_types(modules: &[PactModule]) -> String {
    let mut generator = CodeGenerator::new(true);
    match generator.generate(modules) {
        Ok((_, types)) => types,
        Err(_) => String::new(),
    }
}

impl CodeGenerator {
    pub fn new(generate_types: bool) -> Self {
        Self { generate_types }
    }

    pub fn generate(&mut self, modules: &[PactModule]) -> TransformResult<(String, String)> {
        // Generate code and types in parallel
        let (code_parts, type_parts): (Vec<String>, Vec<String>) = modules
            .par_iter()
            .map(|module| {
                let code = self.generate_module_code(module);
                let types = if self.generate_types {
                    self.generate_module_types(module)
                } else {
                    String::new()
                };
                (code, types)
            })
            .unzip();

        let code = code_parts.join("\n\n");
        let types = if self.generate_types {
            format!(
                "// Auto-generated TypeScript types from Pact contracts\n\n{}",
                type_parts.join("\n\n")
            )
        } else {
            String::new()
        };

        Ok((code, types))
    }

    fn generate_module_code(&self, module: &PactModule) -> String {
        let mut code = String::with_capacity(4096);

        // Generate module header
        if let Some(doc) = &module.doc {
            code.push_str(&convert_to_jsdoc(Some(doc)));
        }

        writeln!(&mut code, "export const {} = {{", module.name).unwrap();
        writeln!(&mut code, "  __module: '{}',", module.name).unwrap();

        // Generate functions in parallel and collect
        let function_codes: Vec<String> = module
            .functions
            .par_iter()
            .map(|func| self.generate_function_code(func, &module.name))
            .collect();

        for func_code in function_codes {
            code.push_str(&func_code);
        }

        // Generate capabilities
        let capability_codes: Vec<String> = module
            .capabilities
            .par_iter()
            .map(|cap| self.generate_capability_code(cap, &module.name))
            .collect();

        for cap_code in capability_codes {
            code.push_str(&cap_code);
        }

        code.push_str("};\n");
        code
    }

    fn generate_function_code(&self, function: &PactFunction, module_name: &str) -> String {
        let mut code = String::with_capacity(1024);

        // Generate JSDoc
        if let Some(doc) = &function.doc {
            code.push_str(&convert_to_jsdoc(Some(doc)));
        }

        // Generate function
        let params =
            function.parameters.iter().map(|p| &p.name).cloned().collect::<Vec<_>>().join(", ");

        writeln!(&mut code, "  {}: ({}) => ({{", function.name, params).unwrap();
        let args_str = if params.is_empty() { String::new() } else { format!(" {}", params) };
        writeln!(&mut code, "    cmd: '({}.{}{})',", module_name, function.name, args_str).unwrap();

        if !params.is_empty() {
            writeln!(&mut code, "    args: [{}],", params).unwrap();
        }

        writeln!(&mut code, "  }}),").unwrap();

        code
    }

    fn generate_capability_code(&self, capability: &PactCapability, module_name: &str) -> String {
        let mut code = String::with_capacity(1024);

        // Generate JSDoc
        if let Some(doc) = &capability.doc {
            code.push_str(&convert_to_jsdoc(Some(doc)));
        }

        // Generate capability
        let params =
            capability.parameters.iter().map(|p| &p.name).cloned().collect::<Vec<_>>().join(", ");

        writeln!(&mut code, "  {}: ({}) => ({{", capability.name, params).unwrap();
        let args_str = if params.is_empty() { String::new() } else { format!(" {}", params) };
        writeln!(&mut code, "    cap: '({}.{}{})',", module_name, capability.name, args_str)
            .unwrap();

        if !params.is_empty() {
            writeln!(&mut code, "    args: [{}],", params).unwrap();
        }

        writeln!(&mut code, "  }}),").unwrap();

        code
    }

    fn generate_module_types(&self, module: &PactModule) -> String {
        let mut types = String::with_capacity(4096);

        // Generate module namespace
        writeln!(&mut types, "export namespace {} {{", module.name).unwrap();

        // Generate schema types
        for schema in &module.schemas {
            types.push_str(&self.generate_schema_type(schema));
        }

        // Generate function types
        for function in &module.functions {
            types.push_str(&self.generate_function_type(function));
        }

        // Generate capability types
        for capability in &module.capabilities {
            types.push_str(&self.generate_capability_type(capability));
        }

        writeln!(&mut types, "}}").unwrap();

        // Generate module type
        writeln!(&mut types, "\nexport interface {}Module {{", module.name).unwrap();
        writeln!(&mut types, "  __module: '{}';", module.name).unwrap();

        for function in &module.functions {
            let param_types = self.generate_param_types(&function.parameters);
            let return_type = function
                .return_type
                .as_ref()
                .map(|t| pact_type_to_typescript(t))
                .unwrap_or_else(|| "any".to_string());

            writeln!(
                &mut types,
                "  {}: ({}) => PactCommand<{}>;",
                function.name, param_types, return_type
            )
            .unwrap();
        }

        for capability in &module.capabilities {
            let param_types = self.generate_param_types(&capability.parameters);
            writeln!(&mut types, "  {}: ({}) => PactCapability;", capability.name, param_types)
                .unwrap();
        }

        writeln!(&mut types, "}}").unwrap();

        types
    }

    fn generate_schema_type(&self, schema: &PactSchema) -> String {
        let mut types = String::with_capacity(512);

        if let Some(doc) = &schema.doc {
            types.push_str(&convert_to_jsdoc(Some(doc)));
        }

        writeln!(&mut types, "  export interface {} {{", schema.name).unwrap();

        for field in &schema.fields {
            let ts_type = pact_type_to_typescript(&field.field_type);
            writeln!(&mut types, "    {}: {};", field.name, ts_type).unwrap();
        }

        writeln!(&mut types, "  }}").unwrap();

        types
    }

    fn generate_function_type(&self, function: &PactFunction) -> String {
        let mut types = String::with_capacity(256);

        if let Some(doc) = &function.doc {
            types.push_str(&convert_to_jsdoc(Some(doc)));
        }

        let param_types = self.generate_param_types(&function.parameters);
        let return_type = function
            .return_type
            .as_ref()
            .map(|t| pact_type_to_typescript(t))
            .unwrap_or_else(|| "any".to_string());

        writeln!(
            &mut types,
            "  export type {}Fn = ({}) => {};",
            function.name, param_types, return_type
        )
        .unwrap();

        types
    }

    fn generate_capability_type(&self, capability: &PactCapability) -> String {
        let mut types = String::with_capacity(256);

        if let Some(doc) = &capability.doc {
            types.push_str(&convert_to_jsdoc(Some(doc)));
        }

        let param_types = self.generate_param_types(&capability.parameters);

        writeln!(&mut types, "  export type {}Cap = ({}) => void;", capability.name, param_types)
            .unwrap();

        types
    }

    fn generate_param_types(&self, parameters: &[PactParameter]) -> String {
        if parameters.is_empty() {
            return String::new();
        }

        parameters
            .iter()
            .map(|p| {
                let ts_type = p
                    .parameter_type
                    .as_ref()
                    .map(|t| pact_type_to_typescript(t))
                    .unwrap_or_else(|| "any".to_string());
                format!("{}: {}", p.name, ts_type)
            })
            .collect::<Vec<_>>()
            .join(", ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_empty_module() {
        let module = PactModule::new("test".to_string(), "governance".to_string());
        let mut generator = CodeGenerator::new(false);
        let (code, _) = generator.generate(&[module]).unwrap();

        assert!(code.contains("export const test = {"));
        assert!(code.contains("__module: 'test'"));
    }

    #[test]
    fn test_generate_function() {
        let mut module = PactModule::new("test".to_string(), "governance".to_string());
        let function = PactFunction {
            name: "add".to_string(),
            doc: Some("Adds two numbers".to_string()),
            parameters: vec![
                PactParameter {
                    name: "a".to_string(),
                    parameter_type: Some("integer".to_string()),
                },
                PactParameter {
                    name: "b".to_string(),
                    parameter_type: Some("integer".to_string()),
                },
            ],
            return_type: Some("integer".to_string()),
            body: "(+ a b)".to_string(),
            is_defun: true,
        };
        module.add_function(function);

        let mut generator = CodeGenerator::new(true);
        let (code, types) = generator.generate(&[module]).unwrap();

        assert!(code.contains("add: (a, b) => ({"));
        assert!(code.contains("cmd: '(test.add a, b)'"));
        assert!(types.contains("add: (a: number, b: number) => PactCommand<number>"));
    }
}
