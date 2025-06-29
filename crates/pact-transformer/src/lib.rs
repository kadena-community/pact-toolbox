#![warn(clippy::all)]
#![warn(clippy::pedantic)]
#![allow(clippy::missing_errors_doc)]
#![allow(clippy::missing_panics_doc)]
#![allow(clippy::cargo_common_metadata)]
#![allow(clippy::multiple_crate_versions)]
#![allow(clippy::wildcard_imports)]
#![allow(clippy::module_name_repetitions)]
#![allow(clippy::cast_possible_truncation)]
#![allow(clippy::too_many_lines)]

use napi_derive::napi;

mod ast;
mod code_generator;
mod config;
mod error;
mod file_ops;
mod parser;
mod plugin;
mod source_map;
mod transformer;
mod types;
mod utils;
mod watch;

// New consolidated API module
mod api;

// Only export the consolidated API
pub use api::{ConfigManager, FileOps, PactTransformer, PluginManager, Utils, WatchSession};

// Internal re-exports for the API module
pub(crate) use config::*;
pub(crate) use file_ops::{batch_file_transform, file_transform, FileOutputOptions};
pub(crate) use plugin::*;
pub(crate) use transformer::{
  core_transform, reset_parser_pool, run_parser_benchmark, warm_up_parsers, CoreTransformer,
  TransformOptions,
};
pub(crate) use watch::{create_watch_session, find_pact_files, WatchHandle, WatchOptions};

// Re-export for testing
#[cfg(test)]
pub use crate::parser::Parser as PublicParser;

#[napi]
pub struct ErrorDetail {
  pub message: String,
  pub line: u32,
  pub column: u32,
}

#[cfg(test)]
mod integration_tests {
  use super::*;

  const SIMPLE_MODULE: &str = r#"
    (module simple-test GOVERNANCE
      @doc "A simple test module"

      (defcap GOVERNANCE () true)

      (defschema user-schema
        @doc "User account schema"
        name: string
        age: integer)

      (defun create-user:string (name:string age:integer)
        @doc "Create a new user"
        (insert users name { "name": name, "age": age })
        name)

      (defconst MAX_AGE:integer 120)
    )
    "#;

  #[test]
  fn test_pact_transformer_integration() {
    let (modules, errors) = CoreTransformer::parse(SIMPLE_MODULE);

    assert!(errors.is_empty(), "Should parse without errors: {errors:?}");
    assert_eq!(modules.len(), 1, "Should parse exactly one module");

    let module = &modules[0];
    assert_eq!(module.name, "simple-test");
    assert_eq!(module.governance, "GOVERNANCE");

    // Check functions
    assert_eq!(module.functions.len(), 1, "Should parse one function");
    let function = &module.functions[0];
    assert_eq!(function.name, "create-user");
    assert_eq!(
      function.parameters.len(),
      2,
      "Function should have 2 parameters"
    );

    // Check parameters
    assert_eq!(function.parameters[0].name, "name");
    assert_eq!(function.parameters[1].name, "age");

    // Check schemas
    assert_eq!(module.schemas.len(), 1, "Should parse one schema");
    let schema = &module.schemas[0];
    assert_eq!(schema.name, "user-schema");
    assert_eq!(schema.fields.len(), 2, "Schema should have 2 fields");

    // Check capabilities
    assert_eq!(module.capabilities.len(), 1, "Should parse one capability");
    let capability = &module.capabilities[0];
    assert_eq!(capability.name, "GOVERNANCE");

    // Check constants
    assert_eq!(module.constants.len(), 1, "Should parse one constant");
    let constant = &module.constants[0];
    assert_eq!(constant.name, "MAX_AGE");
  }

  #[test]
  fn test_empty_module_parsing() {
    let (modules, errors) = CoreTransformer::parse("(module empty GOVERNANCE)");

    assert!(
      errors.is_empty(),
      "Empty module should parse without errors"
    );
    assert_eq!(modules.len(), 1, "Should parse one empty module");

    let module = &modules[0];
    assert_eq!(module.name, "empty");
    assert_eq!(module.governance, "GOVERNANCE");
    assert_eq!(module.functions.len(), 0);
    assert_eq!(module.schemas.len(), 0);
    assert_eq!(module.capabilities.len(), 0);
    assert_eq!(module.constants.len(), 0);
  }

  #[test]
  fn test_multiple_modules() {
    let multi_module = r"
        (module first GOVERNANCE
          (defcap GOVERNANCE () true))
        
        (module second OTHER-GOV
          (defcap OTHER-GOV () true))
        ";

    let (modules, errors) = CoreTransformer::parse(multi_module);
    assert!(
      errors.is_empty(),
      "Multi-module should parse without errors"
    );
    assert_eq!(modules.len(), 2, "Should parse two modules");

    assert_eq!(modules[0].name, "first");
    assert_eq!(modules[0].governance, "GOVERNANCE");
    assert_eq!(modules[1].name, "second");
    assert_eq!(modules[1].governance, "OTHER-GOV");
  }
}
