extern crate napi_build;
use std::env;

fn main() {
  // Set compilation flags for all C dependencies to ensure GNU extensions are available
  if let Ok(target) = env::var("TARGET") {
    if target.contains("linux") {
      // Ensure _GNU_SOURCE is defined for all C code compilation
      println!("cargo:rerun-if-env-changed=CC");
      println!("cargo:rerun-if-env-changed=CFLAGS");

      // Add necessary flags for tree-sitter and other C dependencies
      let cflags = env::var("CFLAGS").unwrap_or_default();
      if !cflags.contains("_GNU_SOURCE") {
        env::set_var(
          "CFLAGS",
          format!("{} -D_GNU_SOURCE -D_DEFAULT_SOURCE", cflags),
        );
      }

      let cppflags = env::var("CPPFLAGS").unwrap_or_default();
      if !cppflags.contains("_GNU_SOURCE") {
        env::set_var(
          "CPPFLAGS",
          format!("{} -D_GNU_SOURCE -D_DEFAULT_SOURCE", cppflags),
        );
      }
    }
  }

  napi_build::setup();
}
