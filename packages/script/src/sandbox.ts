import { createContext, Script, runInContext } from 'vm';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { logger } from '@pact-toolbox/node-utils';
import type { ScriptContext } from './script-context';

export interface SandboxOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Memory limit in MB (requires --max-old-space-size flag) */
  memoryLimit?: number;
  /** Allowed modules to import */
  allowedModules?: string[];
  /** Enable console output */
  enableConsole?: boolean;
  /** Working directory */
  cwd?: string;
}

/**
 * Default allowed modules for scripts
 */
const DEFAULT_ALLOWED_MODULES = [
  // Core Node.js modules (read-only)
  'path',
  'url',
  'util',
  'crypto',
  'buffer',
  'stream',
  'events',
  'querystring',
  
  // Pact toolbox modules (safe APIs)
  '@pact-toolbox/types',
  '@pact-toolbox/utils',
  '@pact-toolbox/crypto',
];

/**
 * Blocked modules that should never be allowed
 */
const BLOCKED_MODULES = [
  'child_process',
  'cluster',
  'dgram',
  'dns',
  'fs',
  'fs/promises',
  'http',
  'https',
  'net',
  'os',
  'process',
  'v8',
  'vm',
  'worker_threads',
];

/**
 * Create a sandboxed environment for script execution
 */
export class ScriptSandbox {
  private context: any;
  private options: Required<SandboxOptions>;

  constructor(options: SandboxOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      memoryLimit: options.memoryLimit ?? 128,
      allowedModules: options.allowedModules ?? DEFAULT_ALLOWED_MODULES,
      enableConsole: options.enableConsole ?? true,
      cwd: options.cwd ?? process.cwd(),
    };

    // Create sandbox context
    this.context = this.createSandboxContext();
  }

  /**
   * Create the sandbox context
   */
  private createSandboxContext(): any {
    const sandbox: Record<string, any> = {
      // Safe globals
      Buffer,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      Promise,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Date,
      RegExp,
      Map,
      Set,
      WeakMap,
      WeakSet,
      JSON,
      Math,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURI,
      encodeURIComponent,
      decodeURI,
      decodeURIComponent,
      // Explicitly remove dangerous globals
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      clearTimeout: undefined,
      clearInterval: undefined,
      clearImmediate: undefined,
      process: undefined,
      global: undefined,
      globalThis: undefined,
      require: this.createSafeRequire(),
    };

    // Add console if enabled
    if (this.options.enableConsole) {
      sandbox.console = {
        log: (...args: any[]) => logger.info('[Script]', ...args),
        info: (...args: any[]) => logger.info('[Script]', ...args),
        warn: (...args: any[]) => logger.warn('[Script]', ...args),
        error: (...args: any[]) => logger.error('[Script]', ...args),
        debug: (...args: any[]) => logger.debug('[Script]', ...args),
      };
    }

    return createContext(sandbox);
  }

  /**
   * Create a safe require function
   */
  private createSafeRequire() {
    const allowedModules = new Set(this.options.allowedModules);
    const blockedModules = new Set(BLOCKED_MODULES);

    return (id: string) => {
      // Check if module is blocked
      if (blockedModules.has(id)) {
        throw new Error(`Module '${id}' is not allowed for security reasons`);
      }

      // Check if module is in allowed list
      if (!allowedModules.has(id)) {
        throw new Error(`Module '${id}' is not allowed. Allowed modules: ${Array.from(allowedModules).join(', ')}`);
      }

      // Prevent path traversal
      if (id.includes('..') || id.startsWith('/')) {
        throw new Error('Absolute paths and path traversal are not allowed');
      }

      try {
        // Load the module in a restricted way
        return require(id);
      } catch (error) {
        throw new Error(`Failed to load module '${id}': ${error}`);
      }
    };
  }

  /**
   * Run a script in the sandbox
   */
  async runScript<T = any>(scriptPath: string, context: ScriptContext): Promise<T> {
    try {
      logger.debug(`Running script in sandbox: ${scriptPath}`);

      // Validate script path
      if (!scriptPath || scriptPath.includes('..')) {
        throw new Error('Invalid script path');
      }

      // Read script content
      const scriptContent = await readFile(scriptPath, 'utf-8');

      // Wrap script to capture exports and provide module context
      const wrappedScript = `
        (function() {
          const exports = {};
          const module = { exports };
          const __filename = '${scriptPath.replace(/'/g, "\\'")}';
          const __dirname = '${dirname(scriptPath).replace(/'/g, "\\'")}';
          
          // User script
          ${scriptContent}
          
          // Return the script object or exports
          return module.exports.default || module.exports || exports;
        })()
      `;

      // Create and run script
      const script = new Script(wrappedScript, {
        filename: scriptPath,
        timeout: this.options.timeout,
      });

      // Add context to sandbox
      this.context.scriptContext = context;

      // Run script in sandbox
      const scriptObject = runInContext(script, this.context, {
        timeout: this.options.timeout,
        breakOnSigint: true,
      });

      // Validate script object
      if (!scriptObject || typeof scriptObject.run !== 'function') {
        throw new Error('Script must export an object with a run method');
      }

      // Execute the run function with the context
      const runScript = new Script(`
        (async function() {
          const scriptObject = arguments[0];
          const context = arguments[1];
          return await scriptObject.run(context);
        })
      `, {
        timeout: this.options.timeout,
      });

      const result = await runInContext(
        runScript, 
        this.context, 
        { timeout: this.options.timeout }
      )(scriptObject, context);

      return result;
    } catch (error) {
      logger.error('Script execution failed in sandbox:', error);
      throw error;
    }
  }

  /**
   * Run raw code in the sandbox
   */
  async runCode<T = any>(code: string, context: any = {}): Promise<T> {
    try {
      const wrappedCode = `
        (async function(context) {
          ${code}
        })(context)
      `;

      const script = new Script(wrappedCode, {
        filename: '<anonymous>',
        timeout: this.options.timeout,
      });

      this.context.context = context;

      return await runInContext(script, this.context, {
        timeout: this.options.timeout,
        breakOnSigint: true,
      });
    } catch (error) {
      logger.error('Code execution failed in sandbox:', error);
      throw error;
    }
  }

  /**
   * Validate script before execution
   */
  async validateScript(scriptPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const scriptContent = await readFile(scriptPath, 'utf-8');

      // Check for dangerous patterns
      const dangerousPatterns = [
        /eval\s*\(/,
        /new\s+Function\s*\(/,
        /require\s*\(\s*['"`]child_process/,
        /require\s*\(\s*['"`]fs/,
        /require\s*\(\s*['"`]net/,
        /require\s*\(\s*['"`]http/,
        /process\.\s*(exit|kill|abort)/,
        /global\s*\[/,
        /globalThis\s*\[/,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(scriptContent)) {
          errors.push(`Dangerous pattern detected: ${pattern.source}`);
        }
      }

      // Try to parse the script
      try {
        new Script(scriptContent, { filename: scriptPath });
      } catch (error) {
        errors.push(`Syntax error: ${error}`);
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Failed to read script: ${error}`);
      return { valid: false, errors };
    }
  }

  /**
   * Destroy the sandbox
   */
  destroy(): void {
    // Clear context references
    this.context = null;
  }
}

/**
 * Create a sandboxed script runner
 */
export function createSandboxedRunner(options?: SandboxOptions): ScriptSandbox {
  return new ScriptSandbox(options);
}

/**
 * Run a script in a sandboxed environment
 */
export async function runSandboxedScript<T = any>(
  scriptPath: string,
  context: ScriptContext,
  options?: SandboxOptions
): Promise<T> {
  const sandbox = createSandboxedRunner(options);
  try {
    // Validate script first
    const validation = await sandbox.validateScript(scriptPath);
    if (!validation.valid) {
      throw new Error(`Script validation failed:\n${validation.errors.join('\n')}`);
    }

    return await sandbox.runScript<T>(scriptPath, context);
  } finally {
    sandbox.destroy();
  }
}

/**
 * Run code in a sandboxed environment
 */
export async function runSandboxedCode<T = any>(
  code: string,
  context: any = {},
  options?: SandboxOptions
): Promise<T> {
  const sandbox = createSandboxedRunner(options);
  try {
    return await sandbox.runCode<T>(code, context);
  } finally {
    sandbox.destroy();
  }
}