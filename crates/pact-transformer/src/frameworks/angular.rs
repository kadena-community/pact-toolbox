use super::{utils, AdditionalFile, CodeGenOptions, FrameworkGenerator, GeneratedCode};
use crate::ast::{PactFunction, PactModule};
use crate::types::pact_type_to_typescript;
use anyhow::Result;
use std::fmt::Write;

/// Angular-specific code generator
pub struct AngularGenerator {
  /// Generate standalone components
  standalone: bool,
  /// Use signals (Angular 16+)
  use_signals: bool,
  /// Generate NgRx effects
  generate_ngrx: bool,
  /// Use RxJS operators
  use_rxjs: bool,
}

impl AngularGenerator {
  pub fn new() -> Self {
    Self {
      standalone: true,
      use_signals: true,
      generate_ngrx: false,
      use_rxjs: true,
    }
  }

  fn generate_services(&self, modules: &[PactModule]) -> Result<String> {
    let mut services = String::new();

    for module in modules {
      services.push_str(&self.generate_module_service(module)?);
      services.push('\n');
    }

    Ok(services)
  }

  fn generate_module_service(&self, module: &PactModule) -> Result<String> {
    let mut code = String::new();
    let service_name = utils::to_service_name(&module.name);

    // Imports
    writeln!(
      &mut code,
      "import {{ Injectable{} }} from '@angular/core';",
      if self.use_signals {
        ", signal, computed"
      } else {
        ""
      }
    )?;

    if self.use_rxjs {
      writeln!(
        &mut code,
        "import {{ Observable, BehaviorSubject, Subject, throwError, of }} from 'rxjs';"
      )?;
      writeln!(
        &mut code,
        "import {{ map, catchError, tap, finalize, shareReplay }} from 'rxjs/operators';"
      )?;
    }

    writeln!(
      &mut code,
      "import {{ HttpClient }} from '@angular/common/http';"
    )?;
    writeln!(
      &mut code,
      "import * as {} from './{}';\n",
      module.name, module.name
    )?;

    // Service decorator
    writeln!(&mut code, "@Injectable({{")?;
    writeln!(&mut code, "  providedIn: 'root'")?;
    writeln!(&mut code, "}})")?;
    writeln!(&mut code, "export class {} {{", service_name)?;

    // Private state
    if self.use_signals {
      writeln!(&mut code, "  // Signals for reactive state")?;
      writeln!(&mut code, "  private readonly _loading = signal(false);")?;
      writeln!(
        &mut code,
        "  private readonly _error = signal<Error | null>(null);"
      )?;
      writeln!(&mut code, "  private readonly _data = signal<any>(null);")?;
      writeln!(&mut code)?;
      writeln!(&mut code, "  // Public computed signals")?;
      writeln!(
        &mut code,
        "  readonly loading = computed(() => this._loading());"
      )?;
      writeln!(
        &mut code,
        "  readonly error = computed(() => this._error());"
      )?;
      writeln!(&mut code, "  readonly data = computed(() => this._data());")?;
    } else if self.use_rxjs {
      writeln!(&mut code, "  // RxJS subjects for state management")?;
      writeln!(
        &mut code,
        "  private readonly _loading$ = new BehaviorSubject<boolean>(false);"
      )?;
      writeln!(
        &mut code,
        "  private readonly _error$ = new BehaviorSubject<Error | null>(null);"
      )?;
      writeln!(
        &mut code,
        "  private readonly _data$ = new BehaviorSubject<any>(null);"
      )?;
      writeln!(&mut code)?;
      writeln!(&mut code, "  // Public observables")?;
      writeln!(
        &mut code,
        "  readonly loading$ = this._loading$.asObservable();"
      )?;
      writeln!(
        &mut code,
        "  readonly error$ = this._error$.asObservable();"
      )?;
      writeln!(&mut code, "  readonly data$ = this._data$.asObservable();")?;
    }

    writeln!(&mut code)?;
    writeln!(
      &mut code,
      "  constructor(private readonly http: HttpClient) {{}}"
    )?;
    writeln!(&mut code)?;

    let (queries, mutations) = utils::group_functions_by_type(module);

    // Generate query methods
    writeln!(&mut code, "  // Query methods")?;
    for function in queries {
      code.push_str(&self.generate_service_method(function, &module.name, false)?);
      code.push('\n');
    }

    // Generate mutation methods
    writeln!(&mut code, "  // Mutation methods")?;
    for function in mutations {
      code.push_str(&self.generate_service_method(function, &module.name, true)?);
      code.push('\n');
    }

    // Utility methods
    writeln!(&mut code, "  // Utility methods")?;
    writeln!(&mut code, "  private setLoading(loading: boolean): void {{")?;
    if self.use_signals {
      writeln!(&mut code, "    this._loading.set(loading);")?;
    } else {
      writeln!(&mut code, "    this._loading$.next(loading);")?;
    }
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code)?;

    writeln!(
      &mut code,
      "  private setError(error: Error | null): void {{"
    )?;
    if self.use_signals {
      writeln!(&mut code, "    this._error.set(error);")?;
    } else {
      writeln!(&mut code, "    this._error$.next(error);")?;
    }
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code)?;

    writeln!(&mut code, "  private setData(data: any): void {{")?;
    if self.use_signals {
      writeln!(&mut code, "    this._data.set(data);")?;
    } else {
      writeln!(&mut code, "    this._data$.next(data);")?;
    }
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code)?;

    writeln!(&mut code, "  reset(): void {{")?;
    writeln!(&mut code, "    this.setLoading(false);")?;
    writeln!(&mut code, "    this.setError(null);")?;
    writeln!(&mut code, "    this.setData(null);")?;
    writeln!(&mut code, "  }}")?;

    writeln!(&mut code, "}}")?;

    Ok(code)
  }

  fn generate_service_method(
    &self,
    function: &PactFunction,
    module_name: &str,
    is_mutation: bool,
  ) -> Result<String> {
    let mut code = String::new();
    let method_name = utils::to_camel_case(&function.name);

    // JSDoc
    if let Some(doc) = &function.doc {
      writeln!(&mut code, "  /**")?;
      writeln!(&mut code, "   * {}", doc)?;
      writeln!(&mut code, "   */")?;
    }

    // Method signature
    let params = self.generate_method_params(function);
    let return_type = if self.use_rxjs {
      format!(
        "Observable<{}>",
        function
          .return_type
          .as_ref()
          .map(|t| pact_type_to_typescript(t))
          .unwrap_or_else(|| "any".to_string())
      )
    } else {
      format!(
        "Promise<{}>",
        function
          .return_type
          .as_ref()
          .map(|t| pact_type_to_typescript(t))
          .unwrap_or_else(|| "any".to_string())
      )
    };

    writeln!(
      &mut code,
      "  {}({}): {} {{",
      method_name, params, return_type
    )?;

    if self.use_rxjs {
      // RxJS implementation
      writeln!(&mut code, "    this.setLoading(true);")?;
      writeln!(&mut code, "    this.setError(null);")?;
      writeln!(&mut code)?;

      writeln!(&mut code, "    // Convert Promise to Observable")?;
      writeln!(
        &mut code,
        "    return from({}.{}({})).pipe(",
        module_name,
        method_name,
        self.generate_param_list(function)
      )?;

      writeln!(&mut code, "      tap(result => {{")?;
      if is_mutation {
        writeln!(&mut code, "        // Update local state after mutation")?;
        writeln!(&mut code, "        this.setData(result);")?;
      } else if function.name.starts_with("get") && !function.name.contains("list") {
        writeln!(&mut code, "        // Cache single item")?;
        writeln!(&mut code, "        this.setData(result);")?;
      }
      writeln!(&mut code, "      }}),")?;

      writeln!(&mut code, "      catchError(error => {{")?;
      writeln!(&mut code, "        this.setError(error);")?;
      writeln!(&mut code, "        return throwError(() => error);")?;
      writeln!(&mut code, "      }}),")?;

      writeln!(&mut code, "      finalize(() => this.setLoading(false)),")?;

      // Add caching for queries
      if !is_mutation && (function.name.contains("list") || function.name.contains("get-all")) {
        writeln!(
          &mut code,
          "      shareReplay({{ bufferSize: 1, refCount: true }}),"
        )?;
      }

      writeln!(&mut code, "    );")?;
    } else {
      // Promise implementation
      writeln!(&mut code, "    this.setLoading(true);")?;
      writeln!(&mut code, "    this.setError(null);")?;
      writeln!(&mut code)?;

      writeln!(
        &mut code,
        "    return {}.{}({})",
        module_name,
        method_name,
        self.generate_param_list(function)
      )?;
      writeln!(&mut code, "      .then(result => {{")?;

      if is_mutation {
        writeln!(&mut code, "        this.setData(result);")?;
      }

      writeln!(&mut code, "        return result;")?;
      writeln!(&mut code, "      }})")?;
      writeln!(&mut code, "      .catch(error => {{")?;
      writeln!(&mut code, "        this.setError(error);")?;
      writeln!(&mut code, "        throw error;")?;
      writeln!(&mut code, "      }})")?;
      writeln!(&mut code, "      .finally(() => this.setLoading(false));")?;
    }

    writeln!(&mut code, "  }}")?;

    Ok(code)
  }

  fn generate_ngrx_effects(&self, module: &PactModule) -> Result<String> {
    let mut code = String::new();
    let effects_name = format!("{}Effects", utils::to_pascal_case(&module.name));

    // Imports
    writeln!(&mut code, "import {{ Injectable }} from '@angular/core';")?;
    writeln!(
      &mut code,
      "import {{ Actions, createEffect, ofType }} from '@ngrx/effects';"
    )?;
    writeln!(&mut code, "import {{ of, from }} from 'rxjs';")?;
    writeln!(
      &mut code,
      "import {{ map, exhaustMap, catchError, tap }} from 'rxjs/operators';"
    )?;
    writeln!(
      &mut code,
      "import * as {} from './{}';\n",
      module.name, module.name
    )?;
    writeln!(
      &mut code,
      "import * as {}Actions from './{}.actions';",
      module.name, module.name
    )?;
    writeln!(&mut code)?;

    writeln!(&mut code, "@Injectable()")?;
    writeln!(&mut code, "export class {} {{", effects_name)?;
    writeln!(&mut code, "  constructor(")?;
    writeln!(&mut code, "    private readonly actions$: Actions,")?;
    writeln!(&mut code, "  ) {{}}")?;
    writeln!(&mut code)?;

    // Generate effects for each function
    for function in &module.functions {
      let effect_name = format!("{}$", utils::to_camel_case(&function.name));
      let action_name = utils::to_camel_case(&function.name);

      writeln!(&mut code, "  {} = createEffect(() =>", effect_name)?;
      writeln!(&mut code, "    this.actions$.pipe(")?;
      writeln!(
        &mut code,
        "      ofType({}Actions.{}),",
        module.name, action_name
      )?;
      writeln!(&mut code, "      exhaustMap(action =>")?;
      writeln!(
        &mut code,
        "        from({}.{}({})).pipe(",
        module.name,
        utils::to_camel_case(&function.name),
        if function.parameters.is_empty() {
          String::new()
        } else {
          "action.payload".to_string()
        }
      )?;
      writeln!(
        &mut code,
        "          map(result => {}Actions.{}Success({{ result }})),",
        module.name, action_name
      )?;
      writeln!(
        &mut code,
        "          catchError(error => of({}Actions.{}Failure({{ error }})))",
        module.name, action_name
      )?;
      writeln!(&mut code, "        )")?;
      writeln!(&mut code, "      )")?;
      writeln!(&mut code, "    )")?;
      writeln!(&mut code, "  );")?;
      writeln!(&mut code)?;
    }

    writeln!(&mut code, "}}")?;

    Ok(code)
  }

  fn generate_ngrx_actions(&self, module: &PactModule) -> Result<String> {
    let mut code = String::new();

    writeln!(
      &mut code,
      "import {{ createAction, props }} from '@ngrx/store';"
    )?;
    writeln!(&mut code)?;

    for function in &module.functions {
      let action_name = utils::to_camel_case(&function.name);
      let action_type_base = format!("[{}] {}", module.name, function.name);

      // Request action
      write!(&mut code, "export const {} = createAction(", action_name)?;
      write!(&mut code, "'{}'", action_type_base)?;

      if !function.parameters.is_empty() {
        write!(&mut code, ", props<{{ payload: {{ ")?;
        for (i, param) in function.parameters.iter().enumerate() {
          if i > 0 {
            write!(&mut code, ", ")?;
          }
          write!(
            &mut code,
            "{}: {}",
            utils::to_camel_case(&param.name),
            param
              .parameter_type
              .as_ref()
              .map(|t| pact_type_to_typescript(t))
              .unwrap_or_else(|| "any".to_string())
          )?;
        }
        write!(&mut code, " }} }}>()")?;
      }
      writeln!(&mut code, ");")?;

      // Success action
      writeln!(
        &mut code,
        "export const {}Success = createAction(",
        action_name
      )?;
      writeln!(&mut code, "  '{} Success',", action_type_base)?;
      writeln!(
        &mut code,
        "  props<{{ result: {} }}>()",
        function
          .return_type
          .as_ref()
          .map(|t| pact_type_to_typescript(t))
          .unwrap_or_else(|| "any".to_string())
      )?;
      writeln!(&mut code, ");")?;

      // Failure action
      writeln!(
        &mut code,
        "export const {}Failure = createAction(",
        action_name
      )?;
      writeln!(&mut code, "  '{} Failure',", action_type_base)?;
      writeln!(&mut code, "  props<{{ error: Error }}>()")?;
      writeln!(&mut code, ");")?;
      writeln!(&mut code)?;
    }

    Ok(code)
  }

  fn generate_interceptor(&self) -> Result<String> {
    let mut code = String::new();

    writeln!(&mut code, "import {{ Injectable }} from '@angular/core';")?;
    writeln!(&mut code, "import {{ HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse }} from '@angular/common/http';")?;
    writeln!(
      &mut code,
      "import {{ Observable, throwError }} from 'rxjs';"
    )?;
    writeln!(
      &mut code,
      "import {{ catchError, retry }} from 'rxjs/operators';"
    )?;
    writeln!(&mut code)?;

    writeln!(&mut code, "@Injectable()")?;
    writeln!(
      &mut code,
      "export class PactInterceptor implements HttpInterceptor {{"
    )?;
    writeln!(
      &mut code,
      "  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {{"
    )?;
    writeln!(&mut code, "    // Add custom headers for Pact requests")?;
    writeln!(&mut code, "    const pactReq = req.clone({{")?;
    writeln!(&mut code, "      setHeaders: {{")?;
    writeln!(&mut code, "        'Content-Type': 'application/json',")?;
    writeln!(&mut code, "        'X-Pact-Client': 'angular-generated'")?;
    writeln!(&mut code, "      }}")?;
    writeln!(&mut code, "    }});")?;
    writeln!(&mut code)?;
    writeln!(&mut code, "    return next.handle(pactReq).pipe(")?;
    writeln!(&mut code, "      retry({{ count: 2, delay: 1000 }}),")?;
    writeln!(
      &mut code,
      "      catchError((error: HttpErrorResponse) => {{"
    )?;
    writeln!(
      &mut code,
      "        console.error('Pact request failed:', error);"
    )?;
    writeln!(&mut code, "        return throwError(() => error);")?;
    writeln!(&mut code, "      }})")?;
    writeln!(&mut code, "    );")?;
    writeln!(&mut code, "  }}")?;
    writeln!(&mut code, "}}")?;

    Ok(code)
  }

  fn generate_method_params(&self, function: &PactFunction) -> String {
    if function.parameters.is_empty() {
      String::new()
    } else {
      function
        .parameters
        .iter()
        .map(|p| {
          let ts_type = p
            .parameter_type
            .as_ref()
            .map(|t| pact_type_to_typescript(t))
            .unwrap_or_else(|| "any".to_string());
          format!("{}: {}", utils::to_camel_case(&p.name), ts_type)
        })
        .collect::<Vec<_>>()
        .join(", ")
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
}

impl FrameworkGenerator for AngularGenerator {
  fn name(&self) -> &'static str {
    "angular"
  }

  fn supported_patterns(&self) -> Vec<&'static str> {
    vec!["services", "ngrx", "signals", "interceptors", "standalone"]
  }

  fn generate(&self, modules: &[PactModule], options: &CodeGenOptions) -> Result<GeneratedCode> {
    let mut additional_files = Vec::new();

    // Generate services
    let services_code = self.generate_services(modules)?;

    // Generate NgRx files if requested
    if self.generate_ngrx || options.patterns.contains(&"ngrx".to_string()) {
      for module in modules {
        // Actions
        additional_files.push(AdditionalFile {
          name: format!("{}.actions.ts", module.name),
          content: self.generate_ngrx_actions(module)?,
          description: Some(format!("NgRx actions for {} module", module.name)),
        });

        // Effects
        additional_files.push(AdditionalFile {
          name: format!("{}.effects.ts", module.name),
          content: self.generate_ngrx_effects(module)?,
          description: Some(format!("NgRx effects for {} module", module.name)),
        });
      }
    }

    // Generate interceptor
    if options.patterns.contains(&"interceptors".to_string()) {
      additional_files.push(AdditionalFile {
        name: "pact.interceptor.ts".to_string(),
        content: self.generate_interceptor()?,
        description: Some("HTTP interceptor for Pact requests".to_string()),
      });
    }

    // Prepare imports
    let mut imports = vec![
      "import { provideHttpClient, withInterceptors } from '@angular/common/http';".to_string(),
    ];

    if self.use_signals {
      imports.push("import { provideSignals } from '@angular/core';".to_string());
    }

    if self.generate_ngrx {
      imports.push("import { provideStore } from '@ngrx/store';".to_string());
      imports.push("import { provideEffects } from '@ngrx/effects';".to_string());
    }

    // Prepare exports
    let exports = modules
      .iter()
      .map(|module| format!("export {{ {} }};", utils::to_service_name(&module.name)))
      .collect();

    Ok(GeneratedCode {
      code: services_code,
      types: None, // TypeScript types are always generated
      additional_files,
      imports,
      exports,
    })
  }

  fn file_extension(&self, _typescript: bool) -> &'static str {
    "service.ts" // Angular always uses TypeScript
  }
}

impl Default for AngularGenerator {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::ast::{PactFunction, PactParameter};

  #[test]
  fn test_angular_generator_creation() {
    let generator = AngularGenerator::new();
    assert_eq!(generator.name(), "angular");
    assert!(generator.supported_patterns().contains(&"services"));
  }

  #[test]
  fn test_service_generation() {
    let generator = AngularGenerator::new();

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

    assert!(result.code.contains("TestService"));
    assert!(result.code.contains("Injectable"));
    assert!(result.code.contains("Observable"));
  }
}
