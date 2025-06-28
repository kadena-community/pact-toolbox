use crate::file_ops::FileOutputOptions;
use crate::transformer::TransformOptions;
use crate::watch::WatchOptions;
use anyhow::{Context, Result};
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PactConfig {
  /// Transformation options
  pub transform: Option<TransformOptions>,

  /// File output options
  pub file_output: Option<FileOutputOptions>,

  /// Watch mode options
  pub watch: Option<WatchOptions>,

  /// Plugin configurations
  pub plugins: Option<Vec<PluginConfig>>,

  /// Configuration presets
  pub presets: Option<HashMap<String, ConfigPreset>>,

  /// Environment-specific overrides
  pub env: Option<HashMap<String, EnvironmentConfig>>,

  /// Extends another configuration file
  pub extends: Option<String>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfig {
  /// Plugin name or path
  pub name: String,

  /// Plugin options
  pub options: Option<HashMap<String, serde_json::Value>>,

  /// Whether the plugin is enabled
  pub enabled: Option<bool>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigPreset {
  /// Preset name
  pub name: String,

  /// Preset description
  pub description: Option<String>,

  /// Transform options for this preset
  pub transform: Option<TransformOptions>,

  /// File output options for this preset
  pub file_output: Option<FileOutputOptions>,

  /// Watch options for this preset
  pub watch: Option<WatchOptions>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentConfig {
  /// Transform options override
  pub transform: Option<TransformOptions>,

  /// File output options override
  pub file_output: Option<FileOutputOptions>,

  /// Watch options override
  pub watch: Option<WatchOptions>,

  /// Plugin overrides
  pub plugins: Option<Vec<PluginConfig>>,
}

/// Config loader result
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ConfigLoadResult {
  /// The loaded configuration
  pub config: PactConfig,

  /// Path to the configuration file
  pub config_path: Option<String>,

  /// Whether default config was used
  pub is_default: bool,
}

impl Default for PactConfig {
  fn default() -> Self {
    Self {
      transform: Some(TransformOptions::default()),
      file_output: Some(FileOutputOptions::default()),
      watch: Some(WatchOptions::default()),
      plugins: Some(Vec::new()),
      presets: Some(HashMap::new()),
      env: Some(HashMap::new()),
      extends: None,
    }
  }
}

/// Load configuration from various sources
#[napi]
pub async fn load_config(
  config_path: Option<String>,
  environment: Option<String>,
) -> Result<ConfigLoadResult, napi::Error> {
  match load_config_impl(config_path.as_deref(), environment.as_deref()).await {
    Ok(result) => Ok(result),
    Err(e) => Err(napi::Error::from_reason(e.to_string())),
  }
}

async fn load_config_impl(
  config_path: Option<&str>,
  environment: Option<&str>,
) -> Result<ConfigLoadResult> {
  // If specific path provided, load from there
  if let Some(path) = config_path {
    let config = load_from_file(path).await?;
    let merged = apply_environment(&config, environment)?;
    return Ok(ConfigLoadResult {
      config: merged,
      config_path: Some(path.to_string()),
      is_default: false,
    });
  }

  // Try common config file locations
  let search_paths = [
    "pact.config.js",
    "pact.config.json",
    "pact.config.toml",
    "pact.config.yaml",
    "pact.config.yml",
    ".pactrc.js",
    ".pactrc.json",
    ".pactrc",
  ];

  for path in &search_paths {
    if Path::new(path).exists() {
      match load_from_file(path).await {
        Ok(config) => {
          let merged = apply_environment(&config, environment)?;
          return Ok(ConfigLoadResult {
            config: merged,
            config_path: Some(path.to_string()),
            is_default: false,
          });
        }
        Err(e) => {
          log::warn!("Failed to load config from {}: {}", path, e);
        }
      }
    }
  }

  // Try loading from package.json
  if let Ok(config) = load_from_package_json().await {
    let merged = apply_environment(&config, environment)?;
    return Ok(ConfigLoadResult {
      config: merged,
      config_path: Some("package.json".to_string()),
      is_default: false,
    });
  }

  // Return default config
  Ok(ConfigLoadResult {
    config: PactConfig::default(),
    config_path: None,
    is_default: true,
  })
}

async fn load_from_file(path: &str) -> Result<PactConfig> {
  let extension = Path::new(path)
    .extension()
    .and_then(|ext| ext.to_str())
    .unwrap_or("");

  match extension {
    "js" => load_js_config(path).await,
    "json" => load_json_config(path),
    "toml" => load_toml_config(path),
    "yaml" | "yml" => load_yaml_config(path),
    _ => {
      // Try to detect format by content
      let content = fs::read_to_string(path)
        .with_context(|| format!("Failed to read config file: {}", path))?;

      if content.trim().starts_with('{') {
        serde_json::from_str(&content)
          .with_context(|| format!("Failed to parse JSON config: {}", path))
      } else if content.contains(" = ") || content.contains("[") {
        toml::from_str(&content).with_context(|| format!("Failed to parse TOML config: {}", path))
      } else {
        serde_yaml::from_str(&content)
          .with_context(|| format!("Failed to parse YAML config: {}", path))
      }
    }
  }
}

async fn load_js_config(path: &str) -> Result<PactConfig> {
  // For JavaScript configs, we need to evaluate them
  // This is a simplified approach - in production, we'd use a proper JS engine
  let content =
    fs::read_to_string(path).with_context(|| format!("Failed to read JS config file: {}", path))?;

  // For now, we'll just try to extract JSON from the JS file
  // This is a placeholder - real implementation would use quickjs or similar
  if let Some(start) = content.find("export default") {
    if let Some(json_start) = content[start..].find('{') {
      let json_part = &content[start + json_start..];
      if let Some(json_end) = find_matching_brace(json_part) {
        let json_str = &json_part[..=json_end];
        return serde_json::from_str(json_str)
          .with_context(|| format!("Failed to parse JS config as JSON: {}", path));
      }
    }
  }

  Err(anyhow::anyhow!(
    "JavaScript config files require the Pact CLI tool for evaluation"
  ))
}

fn load_json_config(path: &str) -> Result<PactConfig> {
  let content = fs::read_to_string(path)
    .with_context(|| format!("Failed to read JSON config file: {}", path))?;

  serde_json::from_str(&content).with_context(|| format!("Failed to parse JSON config: {}", path))
}

fn load_toml_config(path: &str) -> Result<PactConfig> {
  let content = fs::read_to_string(path)
    .with_context(|| format!("Failed to read TOML config file: {}", path))?;

  toml::from_str(&content).with_context(|| format!("Failed to parse TOML config: {}", path))
}

fn load_yaml_config(path: &str) -> Result<PactConfig> {
  let content = fs::read_to_string(path)
    .with_context(|| format!("Failed to read YAML config file: {}", path))?;

  serde_yaml::from_str(&content).with_context(|| format!("Failed to parse YAML config: {}", path))
}

async fn load_from_package_json() -> Result<PactConfig> {
  let content =
    fs::read_to_string("package.json").with_context(|| "Failed to read package.json")?;

  let package_json: serde_json::Value =
    serde_json::from_str(&content).with_context(|| "Failed to parse package.json")?;

  if let Some(pact_config) = package_json.get("pact") {
    serde_json::from_value(pact_config.clone())
      .with_context(|| "Failed to parse pact config from package.json")
  } else {
    Err(anyhow::anyhow!(
      "No pact configuration found in package.json"
    ))
  }
}

fn apply_environment(config: &PactConfig, environment: Option<&str>) -> Result<PactConfig> {
  let mut result = config.clone();

  // Apply extends first
  if let Some(extends_path) = &config.extends {
    let base_config = load_json_config(extends_path)?;
    result = merge_configs(&base_config, &result);
  }

  // Apply environment-specific overrides
  if let Some(env_name) = environment {
    if let Some(env_configs) = &config.env {
      if let Some(env_config) = env_configs.get(env_name) {
        result = apply_env_overrides(&result, env_config);
      }
    }
  }

  Ok(result)
}

fn merge_configs(base: &PactConfig, override_config: &PactConfig) -> PactConfig {
  PactConfig {
    transform: override_config
      .transform
      .clone()
      .or_else(|| base.transform.clone()),
    file_output: override_config
      .file_output
      .clone()
      .or_else(|| base.file_output.clone()),
    watch: override_config.watch.clone().or_else(|| base.watch.clone()),
    plugins: match (&base.plugins, &override_config.plugins) {
      (Some(base_plugins), Some(override_plugins)) => {
        let mut merged = base_plugins.clone();
        merged.extend(override_plugins.clone());
        Some(merged)
      }
      (Some(plugins), None) | (None, Some(plugins)) => Some(plugins.clone()),
      (None, None) => None,
    },
    presets: match (&base.presets, &override_config.presets) {
      (Some(base_presets), Some(override_presets)) => {
        let mut merged = base_presets.clone();
        merged.extend(override_presets.clone());
        Some(merged)
      }
      (Some(presets), None) | (None, Some(presets)) => Some(presets.clone()),
      (None, None) => None,
    },
    env: match (&base.env, &override_config.env) {
      (Some(base_env), Some(override_env)) => {
        let mut merged = base_env.clone();
        merged.extend(override_env.clone());
        Some(merged)
      }
      (Some(env), None) | (None, Some(env)) => Some(env.clone()),
      (None, None) => None,
    },
    extends: override_config.extends.clone(),
  }
}

fn apply_env_overrides(config: &PactConfig, env_config: &EnvironmentConfig) -> PactConfig {
  PactConfig {
    transform: env_config
      .transform
      .clone()
      .or_else(|| config.transform.clone()),
    file_output: env_config
      .file_output
      .clone()
      .or_else(|| config.file_output.clone()),
    watch: env_config.watch.clone().or_else(|| config.watch.clone()),
    plugins: env_config
      .plugins
      .clone()
      .or_else(|| config.plugins.clone()),
    presets: config.presets.clone(),
    env: config.env.clone(),
    extends: config.extends.clone(),
  }
}

fn find_matching_brace(s: &str) -> Option<usize> {
  let mut depth = 0;
  let mut in_string = false;
  let mut escape_next = false;

  for (i, ch) in s.chars().enumerate() {
    if escape_next {
      escape_next = false;
      continue;
    }

    match ch {
      '\\' if in_string => escape_next = true,
      '"' => in_string = !in_string,
      '{' if !in_string => depth += 1,
      '}' if !in_string => {
        depth -= 1;
        if depth == 0 {
          return Some(i);
        }
      }
      _ => {}
    }
  }

  None
}

/// Apply a preset to the current configuration
#[napi]
pub fn apply_preset(config: PactConfig, preset_name: String) -> Result<PactConfig, napi::Error> {
  let presets = config
    .presets
    .as_ref()
    .ok_or_else(|| napi::Error::from_reason("No presets defined in configuration"))?;

  let preset = presets
    .get(&preset_name)
    .ok_or_else(|| napi::Error::from_reason(format!("Preset '{}' not found", preset_name)))?;

  Ok(PactConfig {
    transform: preset
      .transform
      .clone()
      .or_else(|| config.transform.clone()),
    file_output: preset
      .file_output
      .clone()
      .or_else(|| config.file_output.clone()),
    watch: preset.watch.clone().or_else(|| config.watch.clone()),
    plugins: config.plugins.clone(),
    presets: config.presets.clone(),
    env: config.env.clone(),
    extends: config.extends.clone(),
  })
}

/// Validate configuration
#[napi]
pub fn validate_config(config: PactConfig) -> Result<bool, napi::Error> {
  // Validate file output directory exists or can be created
  if let Some(file_output) = &config.file_output {
    let output_dir = Path::new(&file_output.output_dir);
    if !output_dir.exists() && file_output.create_dir.unwrap_or(true) {
      // Check if parent exists
      if let Some(parent) = output_dir.parent() {
        if !parent.exists() {
          return Err(napi::Error::from_reason(format!(
            "Output directory parent does not exist: {}",
            parent.display()
          )));
        }
      }
    }
  }

  // Validate watch patterns
  if let Some(watch) = &config.watch {
    if watch.patterns.is_empty() && watch.directories.as_ref().map_or(true, |d| d.is_empty()) {
      return Err(napi::Error::from_reason(
        "Watch configuration must specify patterns or directories",
      ));
    }
  }

  // Validate plugins
  if let Some(plugins) = &config.plugins {
    for plugin in plugins {
      if plugin.name.is_empty() {
        return Err(napi::Error::from_reason("Plugin name cannot be empty"));
      }
    }
  }

  Ok(true)
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::source_map::SourceMapOptions;
  use std::fs;
  use tempfile::TempDir;

  #[tokio::test]
  async fn test_load_json_config() {
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("pact.config.json");

    let config_content = r#"{
            "transform": {
                "generate_types": true
            },
            "file_output": {
                "output_dir": "./dist",
                "format": "js-types"
            }
        }"#;

    fs::write(&config_path, config_content).unwrap();

    let result = load_config(Some(config_path.to_string_lossy().to_string()), None)
      .await
      .unwrap();

    assert!(!result.is_default);
    assert_eq!(
      result.config.transform.as_ref().unwrap().generate_types,
      Some(true)
    );
    assert_eq!(
      result.config.file_output.as_ref().unwrap().output_dir,
      "./dist"
    );
  }

  #[tokio::test]
  async fn test_load_toml_config() {
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("pact.config.toml");

    let config_content = r#"
[transform]
generate_types = true

[file_output]
output_dir = "./dist"
format = "ts"
"#;

    fs::write(&config_path, config_content).unwrap();

    let result = load_config(Some(config_path.to_string_lossy().to_string()), None)
      .await
      .unwrap();

    assert!(!result.is_default);
    assert_eq!(result.config.file_output.as_ref().unwrap().format, "ts");
  }

  #[tokio::test]
  async fn test_environment_overrides() {
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("pact.config.json");

    let config_content = r#"{
            "transform": {
                "generate_types": true
            },
            "file_output": {
                "output_dir": "./dist",
                "format": "js-types"
            },
            "env": {
                "production": {
                    "file_output": {
                        "output_dir": "./build",
                        "format": "js-only"
                    }
                }
            }
        }"#;

    fs::write(&config_path, config_content).unwrap();

    let result = load_config(
      Some(config_path.to_string_lossy().to_string()),
      Some("production".to_string()),
    )
    .await
    .unwrap();

    assert_eq!(
      result.config.file_output.as_ref().unwrap().output_dir,
      "./build"
    );
    assert_eq!(
      result.config.file_output.as_ref().unwrap().format,
      "js-only"
    );
  }

  #[test]
  fn test_apply_preset() {
    let mut presets = HashMap::new();
    presets.insert(
      "react".to_string(),
      ConfigPreset {
        name: "react".to_string(),
        description: Some("React development preset".to_string()),
        transform: Some(TransformOptions {
          generate_types: Some(true),
          module_name: None,
        }),
        file_output: Some(FileOutputOptions {
          output_dir: "./src/generated".to_string(),
          format: "ts".to_string(),
          create_dir: Some(true),
          preserve_structure: Some(false),
          base_path: None,
          extension: None,
          source_maps: Some(SourceMapOptions::default()),
        }),
        watch: None,
      },
    );

    let config = PactConfig {
      transform: None,
      file_output: None,
      watch: None,
      plugins: None,
      presets: Some(presets),
      env: None,
      extends: None,
    };

    let result = apply_preset(config.clone(), "react".to_string()).unwrap();

    assert_eq!(
      result.file_output.as_ref().unwrap().output_dir,
      "./src/generated"
    );
    assert_eq!(result.file_output.as_ref().unwrap().format, "ts");
  }

  #[test]
  fn test_validate_config() {
    let config = PactConfig {
      transform: Some(TransformOptions::default()),
      file_output: Some(FileOutputOptions {
        output_dir: "/nonexistent/path".to_string(),
        format: "js-types".to_string(),
        create_dir: Some(true),
        preserve_structure: None,
        base_path: None,
        extension: None,
        source_maps: None,
      }),
      watch: Some(WatchOptions {
        patterns: vec!["**/*.pact".to_string()],
        directories: None,
        extensions: None,
        debounce_ms: None,
        max_concurrent: None,
        initial_transform: None,
        handle_deletions: None,
      }),
      plugins: Some(vec![PluginConfig {
        name: "test-plugin".to_string(),
        options: None,
        enabled: Some(true),
      }]),
      presets: None,
      env: None,
      extends: None,
    };

    let result = validate_config(config);
    assert!(result.is_err()); // Should fail due to nonexistent parent directory
  }

  #[test]
  fn test_merge_configs() {
    let base = PactConfig {
      transform: Some(TransformOptions {
        generate_types: Some(true),
        module_name: None,
      }),
      file_output: Some(FileOutputOptions {
        output_dir: "./dist".to_string(),
        format: "js-types".to_string(),
        create_dir: Some(true),
        preserve_structure: None,
        base_path: None,
        extension: None,
        source_maps: None,
      }),
      watch: None,
      plugins: None,
      presets: None,
      env: None,
      extends: None,
    };

    let override_config = PactConfig {
      transform: None,
      file_output: Some(FileOutputOptions {
        output_dir: "./build".to_string(),
        format: "ts".to_string(),
        create_dir: None,
        preserve_structure: None,
        base_path: None,
        extension: None,
        source_maps: None,
      }),
      watch: Some(WatchOptions::default()),
      plugins: None,
      presets: None,
      env: None,
      extends: None,
    };

    let merged = merge_configs(&base, &override_config);

    assert_eq!(
      merged.transform.as_ref().unwrap().generate_types,
      Some(true)
    );
    assert_eq!(merged.file_output.as_ref().unwrap().output_dir, "./build");
    assert_eq!(merged.file_output.as_ref().unwrap().format, "ts");
    assert!(merged.watch.is_some());
  }
}
