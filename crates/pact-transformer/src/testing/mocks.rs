use crate::ast::PactSchema;
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Mock generation options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockOptions {
  /// Use deterministic seed for reproducible mocks
  pub seed: Option<u64>,

  /// Mock provider: "faker", "chance", "casual", "simple"
  pub provider: String,

  /// Locale for generated data
  pub locale: Option<String>,

  /// Custom patterns for specific fields
  pub field_patterns: HashMap<String, String>,

  /// Min/max constraints
  pub constraints: MockConstraints,
}

impl Default for MockOptions {
  fn default() -> Self {
    Self {
      seed: None,
      provider: "simple".to_string(),
      locale: Some("en".to_string()),
      field_patterns: HashMap::new(),
      constraints: MockConstraints::default(),
    }
  }
}

/// Mock value constraints
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockConstraints {
  /// String length constraints
  pub string_min_length: Option<usize>,
  pub string_max_length: Option<usize>,

  /// Number constraints
  pub integer_min: Option<i64>,
  pub integer_max: Option<i64>,
  pub decimal_min: Option<f64>,
  pub decimal_max: Option<f64>,

  /// Array constraints
  pub array_min_length: Option<usize>,
  pub array_max_length: Option<usize>,

  /// Time constraints (as timestamps)
  pub time_min: Option<i64>,
  pub time_max: Option<i64>,
}

impl Default for MockConstraints {
  fn default() -> Self {
    Self {
      string_min_length: Some(1),
      string_max_length: Some(50),
      integer_min: Some(0),
      integer_max: Some(1000),
      decimal_min: Some(0.0),
      decimal_max: Some(1000.0),
      array_min_length: Some(0),
      array_max_length: Some(10),
      time_min: None,
      time_max: None,
    }
  }
}

/// Generated mock value
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MockValue {
  String(String),
  Integer(i64),
  Decimal(f64),
  Bool(bool),
  Time(String), // ISO 8601 format
  Object(HashMap<String, MockValue>),
  Array(Vec<MockValue>),
  Null,
}

impl MockValue {
  /// Convert to JavaScript/TypeScript code
  pub fn to_js_code(&self) -> String {
    match self {
      MockValue::String(s) => format!("'{}'", s.replace('\'', "\\'")),
      MockValue::Integer(i) => i.to_string(),
      MockValue::Decimal(d) => d.to_string(),
      MockValue::Bool(b) => b.to_string(),
      MockValue::Time(t) => format!("new Date('{}')", t),
      MockValue::Object(fields) => {
        let entries: Vec<String> = fields
          .iter()
          .map(|(k, v)| format!("  '{}': {}", k, v.to_js_code()))
          .collect();
        format!("{{\n{}\n}}", entries.join(",\n"))
      }
      MockValue::Array(items) => {
        let elements: Vec<String> = items.iter().map(|v| v.to_js_code()).collect();
        format!("[{}]", elements.join(", "))
      }
      MockValue::Null => "null".to_string(),
    }
  }

  /// Create mock value from Pact type
  pub fn from_pact_type(pact_type: &str, field_name: Option<&str>) -> Self {
    let options = MockOptions::default();
    let mut rng = StdRng::from_entropy();
    Self::from_pact_type_with_options(pact_type, field_name, &options, &mut rng)
  }

  /// Create mock value with options
  pub fn from_pact_type_with_options(
    pact_type: &str,
    field_name: Option<&str>,
    options: &MockOptions,
    rng: &mut StdRng,
  ) -> Self {
    // Check custom patterns first
    if let Some(name) = field_name {
      if let Some(pattern) = options.field_patterns.get(name) {
        return Self::from_pattern(pattern, rng);
      }
    }

    match pact_type {
      "string" => Self::generate_string(field_name, options, rng),
      "integer" => Self::generate_integer(options, rng),
      "decimal" => Self::generate_decimal(options, rng),
      "bool" => Self::Bool(rng.gen_bool(0.5)),
      "time" => Self::generate_time(options, rng),
      "guard" => Self::generate_guard(),
      t if t.starts_with("object{") && t.ends_with('}') => {
        // Extract schema name and generate mock object
        let schema_name = &t[7..t.len() - 1];
        Self::generate_object(schema_name)
      }
      t if t.starts_with('[') && t.ends_with(']') => {
        // Array type
        let inner_type = &t[1..t.len() - 1];
        Self::generate_array(inner_type, options, rng)
      }
      _ => Self::String(format!("mock-{}", pact_type)),
    }
  }

  fn from_pattern(pattern: &str, rng: &mut StdRng) -> Self {
    match pattern {
      "email" => Self::String(Self::generate_email(rng)),
      "name" => Self::String(Self::generate_name(rng)),
      "phone" => Self::String(Self::generate_phone(rng)),
      "address" => Self::String(Self::generate_address(rng)),
      "uuid" => Self::String(Self::generate_uuid()),
      "url" => Self::String(Self::generate_url(rng)),
      _ => Self::String(pattern.to_string()),
    }
  }

  fn generate_string(field_name: Option<&str>, options: &MockOptions, rng: &mut StdRng) -> Self {
    // Smart string generation based on field name
    if let Some(name) = field_name {
      let lower_name = name.to_lowercase();
      if lower_name.contains("email") {
        return Self::String(Self::generate_email(rng));
      } else if lower_name.contains("name") {
        return Self::String(Self::generate_name(rng));
      } else if lower_name.contains("phone") || lower_name.contains("tel") {
        return Self::String(Self::generate_phone(rng));
      } else if lower_name.contains("address") {
        return Self::String(Self::generate_address(rng));
      } else if lower_name.contains("url") || lower_name.contains("website") {
        return Self::String(Self::generate_url(rng));
      } else if lower_name.contains("id") {
        return Self::String(Self::generate_uuid());
      }
    }

    // Generate random string
    let length = rng.gen_range(
      options.constraints.string_min_length.unwrap_or(5)
        ..=options.constraints.string_max_length.unwrap_or(20),
    );

    let chars: String = (0..length)
      .map(|_| {
        let idx = rng.gen_range(0..62);
        match idx {
          0..=25 => (b'a' + idx) as char,
          26..=51 => (b'A' + idx - 26) as char,
          _ => (b'0' + idx - 52) as char,
        }
      })
      .collect();

    Self::String(chars)
  }

  fn generate_integer(options: &MockOptions, rng: &mut StdRng) -> Self {
    let min = options.constraints.integer_min.unwrap_or(0);
    let max = options.constraints.integer_max.unwrap_or(1000);
    Self::Integer(rng.gen_range(min..=max))
  }

  fn generate_decimal(options: &MockOptions, rng: &mut StdRng) -> Self {
    let min = options.constraints.decimal_min.unwrap_or(0.0);
    let max = options.constraints.decimal_max.unwrap_or(1000.0);
    let value = rng.gen_range(min..=max);
    // Round to 2 decimal places
    Self::Decimal((value * 100.0).round() / 100.0)
  }

  fn generate_time(options: &MockOptions, rng: &mut StdRng) -> Self {
    use chrono::{TimeZone, Utc};

    let now = Utc::now().timestamp();
    let min = options
      .constraints
      .time_min
      .unwrap_or(now - 365 * 24 * 60 * 60); // 1 year ago
    let max = options.constraints.time_max.unwrap_or(now);

    let timestamp = rng.gen_range(min..=max);
    let dt = Utc.timestamp_opt(timestamp, 0).unwrap();

    Self::Time(dt.to_rfc3339())
  }

  fn generate_guard() -> Self {
    // Simple keyset guard mock
    Self::Object(HashMap::from([
      (
        "keys".to_string(),
        Self::Array(vec![Self::String(
          "368820f80c324bbc7c2b0b11eb5e06ee5b589e72711cd6253fb9e43dd8350c1e".to_string(),
        )]),
      ),
      ("pred".to_string(), Self::String("keys-all".to_string())),
    ]))
  }

  fn generate_object(schema_name: &str) -> Self {
    // For now, generate a simple object
    // In a real implementation, this would look up the schema definition
    Self::Object(HashMap::from([
      ("id".to_string(), Self::String(Self::generate_uuid())),
      ("type".to_string(), Self::String(schema_name.to_string())),
      (
        "created".to_string(),
        Self::Time(chrono::Utc::now().to_rfc3339()),
      ),
    ]))
  }

  fn generate_array(inner_type: &str, options: &MockOptions, rng: &mut StdRng) -> Self {
    let min_len = options.constraints.array_min_length.unwrap_or(1);
    let max_len = options.constraints.array_max_length.unwrap_or(5);
    let length = rng.gen_range(min_len..=max_len);

    let items: Vec<MockValue> = (0..length)
      .map(|_| Self::from_pact_type_with_options(inner_type, None, options, rng))
      .collect();

    Self::Array(items)
  }

  // Helper generators
  fn generate_email(rng: &mut StdRng) -> String {
    let names = ["john", "jane", "mike", "sarah", "alex", "emma"];
    let domains = ["example.com", "test.com", "email.com", "mock.com"];
    let name = names[rng.gen_range(0..names.len())];
    let domain = domains[rng.gen_range(0..domains.len())];
    format!("{}.{}@{}", name, rng.gen_range(1000..9999), domain)
  }

  fn generate_name(rng: &mut StdRng) -> String {
    let first_names = ["John", "Jane", "Michael", "Sarah", "Alexander", "Emma"];
    let last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Davis"];
    let first = first_names[rng.gen_range(0..first_names.len())];
    let last = last_names[rng.gen_range(0..last_names.len())];
    format!("{} {}", first, last)
  }

  fn generate_phone(rng: &mut StdRng) -> String {
    format!(
      "+1-{}-{}-{}",
      rng.gen_range(200..999),
      rng.gen_range(200..999),
      rng.gen_range(1000..9999)
    )
  }

  fn generate_address(rng: &mut StdRng) -> String {
    let streets = ["Main St", "Oak Ave", "Elm Dr", "Park Blvd", "First St"];
    let cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"];
    let street = streets[rng.gen_range(0..streets.len())];
    let city = cities[rng.gen_range(0..cities.len())];
    format!("{} {}, {}", rng.gen_range(1..999), street, city)
  }

  fn generate_url(rng: &mut StdRng) -> String {
    let domains = ["example", "test", "mock", "demo"];
    let tlds = ["com", "org", "net", "io"];
    let domain = domains[rng.gen_range(0..domains.len())];
    let tld = tlds[rng.gen_range(0..tlds.len())];
    format!("https://{}.{}", domain, tld)
  }

  fn generate_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
  }
}

/// Mock generator for creating test data
pub struct MockGenerator {
  options: MockOptions,
  rng: StdRng,
}

impl MockGenerator {
  /// Create new mock generator
  pub fn new(options: MockOptions) -> Self {
    let rng = if let Some(seed) = options.seed {
      StdRng::seed_from_u64(seed)
    } else {
      StdRng::from_entropy()
    };

    Self { options, rng }
  }

  /// Generate mock for a schema
  pub fn generate_for_schema(&mut self, schema: &PactSchema) -> MockValue {
    let mut fields = HashMap::new();

    for field in &schema.fields {
      let mock_value = MockValue::from_pact_type_with_options(
        &field.field_type,
        Some(&field.name),
        &self.options,
        &mut self.rng,
      );
      fields.insert(field.name.clone(), mock_value);
    }

    MockValue::Object(fields)
  }

  /// Generate multiple mocks for a schema
  pub fn generate_many_for_schema(&mut self, schema: &PactSchema, count: usize) -> Vec<MockValue> {
    (0..count)
      .map(|_| self.generate_for_schema(schema))
      .collect()
  }

  /// Generate mock for a specific type
  pub fn generate_for_type(&mut self, pact_type: &str) -> MockValue {
    MockValue::from_pact_type_with_options(pact_type, None, &self.options, &mut self.rng)
  }

  /// Generate fixture file content
  pub fn generate_fixtures(&mut self, schemas: &[PactSchema]) -> String {
    let mut fixtures = String::new();
    fixtures.push_str("// Generated test fixtures\n\n");

    for schema in schemas {
      let pascal_name = to_pascal_case(&schema.name);

      // Single fixture
      fixtures.push_str(&format!("export const mock{} = ", pascal_name));
      fixtures.push_str(&self.generate_for_schema(schema).to_js_code());
      fixtures.push_str(";\n\n");

      // Multiple fixtures
      fixtures.push_str(&format!("export const mock{}List = [\n", pascal_name));
      for (i, mock) in self.generate_many_for_schema(schema, 3).iter().enumerate() {
        if i > 0 {
          fixtures.push_str(",\n");
        }
        fixtures.push_str("  ");
        fixtures.push_str(&mock.to_js_code());
      }
      fixtures.push_str("\n];\n\n");
    }

    // Export all fixtures
    fixtures.push_str("export const fixtures = {\n");
    for schema in schemas {
      let pascal_name = to_pascal_case(&schema.name);
      let camel_name = to_camel_case(&schema.name);
      fixtures.push_str(&format!("  {}: mock{},\n", camel_name, pascal_name));
      fixtures.push_str(&format!("  {}List: mock{}List,\n", camel_name, pascal_name));
    }
    fixtures.push_str("};\n");

    fixtures
  }
}

// Helper functions for case conversion
fn to_pascal_case(s: &str) -> String {
  let mut result = String::new();
  let mut capitalize_next = true;

  for c in s.chars() {
    if c == '-' || c == '_' {
      capitalize_next = true;
    } else if capitalize_next {
      result.push(c.to_uppercase().next().unwrap_or(c));
      capitalize_next = false;
    } else {
      result.push(c);
    }
  }

  result
}

fn to_camel_case(s: &str) -> String {
  let mut result = String::new();
  let mut capitalize_next = false;

  for (i, c) in s.chars().enumerate() {
    if c == '-' || c == '_' {
      capitalize_next = true;
    } else if i == 0 {
      result.push(c.to_lowercase().next().unwrap_or(c));
    } else if capitalize_next {
      result.push(c.to_uppercase().next().unwrap_or(c));
      capitalize_next = false;
    } else {
      result.push(c);
    }
  }

  result
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_mock_string_generation() {
    let mock = MockValue::from_pact_type("string", Some("email"));
    match mock {
      MockValue::String(s) => assert!(s.contains('@')),
      _ => panic!("Expected string"),
    }
  }

  #[test]
  fn test_mock_number_generation() {
    let mock = MockValue::from_pact_type("integer", None);
    match mock {
      MockValue::Integer(_) => {}
      _ => panic!("Expected integer"),
    }

    let mock = MockValue::from_pact_type("decimal", None);
    match mock {
      MockValue::Decimal(_) => {}
      _ => panic!("Expected decimal"),
    }
  }

  #[test]
  fn test_mock_array_generation() {
    let mock = MockValue::from_pact_type("[string]", None);
    match mock {
      MockValue::Array(items) => {
        assert!(!items.is_empty());
        match &items[0] {
          MockValue::String(_) => {}
          _ => panic!("Expected string in array"),
        }
      }
      _ => panic!("Expected array"),
    }
  }

  #[test]
  fn test_deterministic_generation() {
    let options = MockOptions {
      seed: Some(12345),
      ..Default::default()
    };

    let mut gen1 = MockGenerator::new(options.clone());
    let mock1 = gen1.generate_for_type("string");

    let mut gen2 = MockGenerator::new(options);
    let mock2 = gen2.generate_for_type("string");

    // Should produce same result with same seed
    match (mock1, mock2) {
      (MockValue::String(s1), MockValue::String(s2)) => assert_eq!(s1, s2),
      _ => panic!("Expected strings"),
    }
  }
}
