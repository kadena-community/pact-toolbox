use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Coverage reporter for test results
pub struct CoverageReporter;

impl CoverageReporter {
  pub fn new() -> Self {
    Self
  }

  /// Generate coverage report
  pub fn generate_report(
    &self,
    results: &TestResults,
    options: &CoverageOptions,
  ) -> Result<CoverageReport> {
    let mut report = CoverageReport {
      summary: CoverageSummary::default(),
      modules: HashMap::new(),
      functions: HashMap::new(),
      uncovered_lines: Vec::new(),
      timestamp: chrono::Utc::now().to_rfc3339(),
    };

    // Calculate coverage metrics
    for module in &results.modules {
      let module_coverage = self.calculate_module_coverage(module, results);
      report.modules.insert(module.name.clone(), module_coverage);

      for function in &module.functions {
        let function_coverage = self.calculate_function_coverage(function, module, results);
        let key = format!("{}.{}", module.name, function.name);
        report.functions.insert(key, function_coverage);
      }
    }

    // Update summary
    report.summary = self.calculate_summary(&report);

    // Find uncovered lines
    if options.report_uncovered_lines {
      report.uncovered_lines = self.find_uncovered_lines(&report);
    }

    Ok(report)
  }

  fn calculate_module_coverage(
    &self,
    module: &ModuleTestResult,
    _results: &TestResults,
  ) -> ModuleCoverage {
    let total_functions = module.functions.len();
    let tested_functions = module
      .functions
      .iter()
      .filter(|f| f.tests_passed > 0)
      .count();

    let total_tests = module
      .functions
      .iter()
      .map(|f| f.tests_passed + f.tests_failed)
      .sum();

    let passed_tests = module.functions.iter().map(|f| f.tests_passed).sum();

    ModuleCoverage {
      name: module.name.clone(),
      function_coverage: if total_functions > 0 {
        (tested_functions as f64 / total_functions as f64) * 100.0
      } else {
        0.0
      },
      line_coverage: 0.0,   // Would need actual line execution data
      branch_coverage: 0.0, // Would need branch execution data
      test_coverage: if total_tests > 0 {
        (passed_tests as f64 / total_tests as f64) * 100.0
      } else {
        0.0
      },
      total_functions,
      tested_functions,
      total_tests,
      passed_tests,
    }
  }

  fn calculate_function_coverage(
    &self,
    function: &FunctionTestResult,
    module: &ModuleTestResult,
    _results: &TestResults,
  ) -> FunctionCoverage {
    let total_tests = function.tests_passed + function.tests_failed;

    FunctionCoverage {
      name: function.name.clone(),
      module: module.name.clone(),
      tests_count: total_tests,
      tests_passed: function.tests_passed,
      tests_failed: function.tests_failed,
      coverage_percentage: if total_tests > 0 {
        (function.tests_passed as f64 / total_tests as f64) * 100.0
      } else {
        0.0
      },
      has_happy_path_test: function.test_types.contains(&"happy-path".to_string()),
      has_error_test: function.test_types.contains(&"error-cases".to_string()),
      has_property_test: function.test_types.contains(&"property".to_string()),
      execution_time_ms: function.execution_time_ms,
    }
  }

  fn calculate_summary(&self, report: &CoverageReport) -> CoverageSummary {
    let total_modules = report.modules.len();
    let total_functions: usize = report.modules.values().map(|m| m.total_functions).sum();
    let tested_functions: usize = report.modules.values().map(|m| m.tested_functions).sum();
    let total_tests: usize = report.modules.values().map(|m| m.total_tests).sum();
    let passed_tests: usize = report.modules.values().map(|m| m.passed_tests).sum();

    let function_coverage = if total_functions > 0 {
      (tested_functions as f64 / total_functions as f64) * 100.0
    } else {
      0.0
    };

    let test_pass_rate = if total_tests > 0 {
      (passed_tests as f64 / total_tests as f64) * 100.0
    } else {
      0.0
    };

    CoverageSummary {
      total_modules,
      total_functions,
      tested_functions,
      untested_functions: total_functions - tested_functions,
      total_tests,
      passed_tests,
      failed_tests: total_tests - passed_tests,
      function_coverage,
      line_coverage: 0.0,   // Would need actual line data
      branch_coverage: 0.0, // Would need branch data
      test_pass_rate,
    }
  }

  fn find_uncovered_lines(&self, report: &CoverageReport) -> Vec<UncoveredLine> {
    let mut uncovered = Vec::new();

    for (_function_key, coverage) in &report.functions {
      if coverage.coverage_percentage < 100.0 {
        uncovered.push(UncoveredLine {
          module: coverage.module.clone(),
          function: coverage.name.clone(),
          reason: if coverage.tests_count == 0 {
            "No tests written".to_string()
          } else if !coverage.has_happy_path_test {
            "Missing happy path test".to_string()
          } else if !coverage.has_error_test {
            "Missing error handling test".to_string()
          } else {
            "Incomplete test coverage".to_string()
          },
        });
      }
    }

    uncovered
  }

  /// Generate HTML coverage report
  pub fn generate_html_report(&self, report: &CoverageReport) -> String {
    let mut html = String::new();

    html.push_str(&format!(r#"<!DOCTYPE html>
<html>
<head>
    <title>Pact Test Coverage Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .summary {{ background: #f0f0f0; padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
        .metric {{ display: inline-block; margin-right: 20px; }}
        .good {{ color: green; }}
        .warning {{ color: orange; }}
        .bad {{ color: red; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #4CAF50; color: white; }}
        tr:nth-child(even) {{ background-color: #f2f2f2; }}
        .progress {{ width: 100%; background-color: #f0f0f0; }}
        .progress-bar {{ height: 20px; background-color: #4CAF50; text-align: center; color: white; }}
    </style>
</head>
<body>
    <h1>Pact Test Coverage Report</h1>
    <p>Generated: {}</p>
    
    <div class="summary">
        <h2>Summary</h2>
        <div class="metric">
            <strong>Function Coverage:</strong> 
            <span class="{}">{:.1}%</span>
        </div>
        <div class="metric">
            <strong>Test Pass Rate:</strong> 
            <span class="{}">{:.1}%</span>
        </div>
        <div class="metric">
            <strong>Total Tests:</strong> {} ({} passed, {} failed)
        </div>
    </div>
    
    <h2>Module Coverage</h2>
    <table>
        <tr>
            <th>Module</th>
            <th>Functions</th>
            <th>Coverage</th>
            <th>Tests</th>
            <th>Pass Rate</th>
        </tr>"#,
            report.timestamp,
            Self::get_coverage_class(report.summary.function_coverage),
            report.summary.function_coverage,
            Self::get_coverage_class(report.summary.test_pass_rate),
            report.summary.test_pass_rate,
            report.summary.total_tests,
            report.summary.passed_tests,
            report.summary.failed_tests
        ));

    // Module rows
    for (name, coverage) in &report.modules {
      html.push_str(&format!(
        r#"
        <tr>
            <td>{}</td>
            <td>{} / {}</td>
            <td>
                <div class="progress">
                    <div class="progress-bar" style="width: {:.1}%">{:.1}%</div>
                </div>
            </td>
            <td>{}</td>
            <td class="{}">{:.1}%</td>
        </tr>"#,
        name,
        coverage.tested_functions,
        coverage.total_functions,
        coverage.function_coverage,
        coverage.function_coverage,
        coverage.total_tests,
        Self::get_coverage_class(coverage.test_coverage),
        coverage.test_coverage
      ));
    }

    html.push_str("    </table>\n");

    // Uncovered functions
    if !report.uncovered_lines.is_empty() {
      html.push_str(
        r#"
    <h2>Uncovered Functions</h2>
    <table>
        <tr>
            <th>Module</th>
            <th>Function</th>
            <th>Reason</th>
        </tr>"#,
      );

      for uncovered in &report.uncovered_lines {
        html.push_str(&format!(
          r#"
        <tr>
            <td>{}</td>
            <td>{}</td>
            <td>{}</td>
        </tr>"#,
          uncovered.module, uncovered.function, uncovered.reason
        ));
      }

      html.push_str("    </table>\n");
    }

    html.push_str("</body>\n</html>");

    html
  }

  fn get_coverage_class(percentage: f64) -> &'static str {
    if percentage >= 80.0 {
      "good"
    } else if percentage >= 60.0 {
      "warning"
    } else {
      "bad"
    }
  }
}

/// Coverage options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageOptions {
  /// Report format: "json", "html", "lcov", "text"
  pub format: String,

  /// Output directory for reports
  pub output_dir: String,

  /// Include uncovered lines in report
  pub report_uncovered_lines: bool,

  /// Minimum coverage thresholds
  pub thresholds: CoverageThresholds,

  /// Fail if coverage is below threshold
  pub fail_on_threshold: bool,
}

impl Default for CoverageOptions {
  fn default() -> Self {
    Self {
      format: "html".to_string(),
      output_dir: "coverage".to_string(),
      report_uncovered_lines: true,
      thresholds: CoverageThresholds::default(),
      fail_on_threshold: false,
    }
  }
}

/// Coverage thresholds
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageThresholds {
  pub functions: f64,
  pub lines: f64,
  pub branches: f64,
  pub statements: f64,
}

impl Default for CoverageThresholds {
  fn default() -> Self {
    Self {
      functions: 80.0,
      lines: 80.0,
      branches: 80.0,
      statements: 80.0,
    }
  }
}

/// Coverage report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageReport {
  /// Summary statistics
  pub summary: CoverageSummary,

  /// Coverage by module
  pub modules: HashMap<String, ModuleCoverage>,

  /// Coverage by function
  pub functions: HashMap<String, FunctionCoverage>,

  /// Uncovered lines/functions
  pub uncovered_lines: Vec<UncoveredLine>,

  /// Report timestamp
  pub timestamp: String,
}

/// Coverage summary
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CoverageSummary {
  pub total_modules: usize,
  pub total_functions: usize,
  pub tested_functions: usize,
  pub untested_functions: usize,
  pub total_tests: usize,
  pub passed_tests: usize,
  pub failed_tests: usize,
  pub function_coverage: f64,
  pub line_coverage: f64,
  pub branch_coverage: f64,
  pub test_pass_rate: f64,
}

/// Module coverage data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleCoverage {
  pub name: String,
  pub function_coverage: f64,
  pub line_coverage: f64,
  pub branch_coverage: f64,
  pub test_coverage: f64,
  pub total_functions: usize,
  pub tested_functions: usize,
  pub total_tests: usize,
  pub passed_tests: usize,
}

/// Function coverage data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCoverage {
  pub name: String,
  pub module: String,
  pub tests_count: usize,
  pub tests_passed: usize,
  pub tests_failed: usize,
  pub coverage_percentage: f64,
  pub has_happy_path_test: bool,
  pub has_error_test: bool,
  pub has_property_test: bool,
  pub execution_time_ms: Option<u64>,
}

/// Uncovered line/function
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UncoveredLine {
  pub module: String,
  pub function: String,
  pub reason: String,
}

/// Test results for coverage calculation
#[derive(Debug, Clone)]
pub struct TestResults {
  pub modules: Vec<ModuleTestResult>,
}

/// Module test results
#[derive(Debug, Clone)]
pub struct ModuleTestResult {
  pub name: String,
  pub functions: Vec<FunctionTestResult>,
}

/// Function test results
#[derive(Debug, Clone)]
pub struct FunctionTestResult {
  pub name: String,
  pub tests_passed: usize,
  pub tests_failed: usize,
  pub test_types: Vec<String>,
  pub execution_time_ms: Option<u64>,
}

impl Default for CoverageReporter {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_coverage_calculation() {
    let results = TestResults {
      modules: vec![ModuleTestResult {
        name: "test-module".to_string(),
        functions: vec![
          FunctionTestResult {
            name: "function1".to_string(),
            tests_passed: 3,
            tests_failed: 1,
            test_types: vec!["happy-path".to_string(), "error-cases".to_string()],
            execution_time_ms: Some(100),
          },
          FunctionTestResult {
            name: "function2".to_string(),
            tests_passed: 2,
            tests_failed: 0,
            test_types: vec!["happy-path".to_string()],
            execution_time_ms: Some(50),
          },
        ],
      }],
    };

    let reporter = CoverageReporter::new();
    let options = CoverageOptions::default();
    let report = reporter.generate_report(&results, &options).unwrap();

    assert_eq!(report.summary.total_functions, 2);
    assert_eq!(report.summary.tested_functions, 2);
    assert_eq!(report.summary.total_tests, 6);
    assert_eq!(report.summary.passed_tests, 5);
    assert_eq!(report.summary.test_pass_rate, 83.33333333333334);
  }
}
