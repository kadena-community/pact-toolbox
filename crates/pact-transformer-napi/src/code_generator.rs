use crate::types::*;
use crate::utils;

/// Generate JavaScript/TypeScript code for a Pact module
pub fn generate_module_code(module: &PactModule, debug: bool) -> (String, String) {
    let mut code = String::new();
    let mut types = String::new();

    // Generate schema types first
    for schema in &module.schemas {
        let schema_types = generate_schema_types(schema);
        types.push_str(&schema_types);
        types.push('\n');
    }

    // Generate function code and types
    for function in &module.functions {
        let function_code = generate_function_code(function, debug);
        code.push_str(&function_code);
        code.push('\n');

        let function_types = generate_function_types(function);
        types.push_str(&function_types);
        types.push('\n');
    }

    (code, types)
}

/// Generate JavaScript code for a Pact function
pub fn generate_function_code(function: &PactFunction, debug: bool) -> String {
    let param_list = function.parameters
        .iter()
        .map(|p| utils::to_camel_case(&p.name))
        .collect::<Vec<_>>()
        .join(", ");

    let pact_call = if function.parameters.is_empty() {
        format!("\"({})\"", function.path)
    } else {
        let param_interpolations = function.parameters
            .iter()
            .map(|p| format!("${{JSON.stringify({})}}", utils::to_camel_case(&p.name)))
            .collect::<Vec<_>>()
            .join(" ");
        format!("`({} {})`", function.path, param_interpolations)
    };

    let mut lines = vec![
        format!("export function {}({}) {{", utils::to_camel_case(&function.name), param_list),
    ];

    if debug {
        lines.push(format!(
            "  console.log(\"%c[pact-toolbox] executing pact code\", 'font-weight: bold; font-style: italic', {});",
            pact_call
        ));
    }

    lines.push(format!("  return execution({});", pact_call));
    lines.push("}".to_string());

    lines.join("\n")
}

/// Generate TypeScript type declarations for a Pact function
pub fn generate_function_types(function: &PactFunction) -> String {
    let param_list = function.parameters
        .iter()
        .map(|p| {
            format!(
                "{}: {}",
                utils::to_camel_case(&p.name),
                utils::pact_type_to_typescript_type(&p.param_type, &get_dummy_module())
            )
        })
        .collect::<Vec<_>>()
        .join(", ");

    let return_type = utils::pact_type_to_typescript_type(
        &function.return_type,
        &get_dummy_module()
    );

    let jsdoc = utils::convert_to_jsdoc(function.doc.as_deref());

    format!(
        "{}export function {}({}): PactTransactionBuilder<PactExecPayload, {}>;",
        jsdoc,
        utils::to_camel_case(&function.name),
        param_list,
        return_type
    )
}

/// Generate TypeScript interface definitions for a Pact schema
pub fn generate_schema_types(schema: &PactSchema) -> String {
    let field_list = schema.fields
        .iter()
        .map(|f| {
            format!(
                "  {}: {};",
                f.name,
                utils::pact_type_to_typescript_type(&f.field_type, &get_dummy_module())
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let jsdoc = utils::convert_to_jsdoc(schema.doc.as_deref());

    format!(
        "{}export interface {} {{\n{}\n}}",
        jsdoc,
        utils::to_pascal_case(&schema.name),
        field_list
    )
}

/// Create a dummy module for type resolution (temporary workaround)
/// In a real implementation, you'd pass the actual module context
fn get_dummy_module() -> PactModule {
    PactModule::new("dummy".to_string(), None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_function_code() {
        let mut function = PactFunction::new("test-function".to_string(), "test.module");
        function.parameters.push(PactParameter {
            name: "account".to_string(),
            param_type: "string".to_string(),
        });
        function.parameters.push(PactParameter {
            name: "amount".to_string(),
            param_type: "decimal".to_string(),
        });

        let code = generate_function_code(&function, false);
        assert!(code.contains("export function testFunction(account, amount)"));
        assert!(code.contains("return execution(`(test.module.test-function ${JSON.stringify(account)} ${JSON.stringify(amount)})`)"));
    }

    #[test]
    fn test_generate_function_code_no_params() {
        let function = PactFunction::new("simple-function".to_string(), "test.module");
        let code = generate_function_code(&function, false);
        assert!(code.contains("export function simpleFunction()"));
        assert!(code.contains("return execution(\"(test.module.simple-function)\")"));
    }

    #[test]
    fn test_generate_function_types() {
        let mut function = PactFunction::new("test-function".to_string(), "test.module");
        function.parameters.push(PactParameter {
            name: "account".to_string(),
            param_type: "string".to_string(),
        });
        function.return_type = "bool".to_string();

        let types = generate_function_types(&function);
        assert!(types.contains("export function testFunction(account: string): PactTransactionBuilder<PactExecPayload, boolean>"));
    }

    #[test]
    fn test_generate_schema_types() {
        let mut schema = PactSchema::new("user-account".to_string());
        schema.fields.push(PactSchemaField {
            name: "account".to_string(),
            field_type: "string".to_string(),
        });
        schema.fields.push(PactSchemaField {
            name: "balance".to_string(),
            field_type: "decimal".to_string(),
        });

        let types = generate_schema_types(&schema);
        assert!(types.contains("export interface UserAccount"));
        assert!(types.contains("account: string;"));
        assert!(types.contains("balance: number;"));
    }
}
