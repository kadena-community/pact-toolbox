import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import type { NetworkOptions } from "@pact-toolbox/network";
import type { ChainId } from "@pact-toolbox/types";
import { createJiti } from "jiti";
import { fileURLToPath } from "mlly";
import { resolve } from "pathe";

import { resolveConfig } from "@pact-toolbox/config";
import { createNetwork } from "@pact-toolbox/network";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger, defu, cleanupOnExit } from "@pact-toolbox/node-utils";

import type { ScriptContext } from "./script-context";
import { createScriptContextBuilder } from "./script-context";
import { createWalletManager, resolveSigningConfig, type SigningConfig } from "./wallet-manager";
import { createNamespaceHandler, type NamespaceHandlingOptions } from "./namespace-handler";

export interface ScriptOptions {
  /** Auto-start network before script execution */
  autoStartNetwork?: boolean;
  /** Persist network after script completion */
  persist?: boolean;
  /** Network startup options */
  startNetworkOptions?: Partial<NetworkOptions>;
  /** Configuration overrides */
  configOverrides?: Partial<PactToolboxConfigObj>;
  /** Network to use for script execution */
  network?: string;
  /** Signing configuration */
  signing?: SigningConfig;
  /** Namespace handling configuration */
  namespaceHandling?: NamespaceHandlingOptions;
  /** Script metadata */
  metadata?: {
    name?: string;
    description?: string;
    version?: string;
    author?: string;
    tags?: string[];
  };
  /** Pre and post execution hooks */
  hooks?: {
    preRun?: (context: ScriptContext) => Promise<void>;
    postRun?: (context: ScriptContext, result: any) => Promise<void>;
    onError?: (context: ScriptContext, error: Error) => Promise<void>;
  };
  /** Environment-specific configuration */
  environment?: Record<string, any>;
  /** Script timeout in milliseconds */
  timeout?: number;
  /** Enable script profiling */
  profile?: boolean;
}

export interface Script<Args = Record<string, unknown>> extends ScriptOptions {
  /** Script execution function */
  run: (ctx: ScriptContext<Args>) => Promise<any>;
}

export interface RunScriptOptions {
  /** Working directory */
  cwd?: string;
  /** Network to use */
  network?: string;
  /** Script arguments */
  args?: Record<string, unknown>;
  /** Configuration object */
  config?: PactToolboxConfigObj;
  /** Pre-configured client */
  client?: PactToolboxClient;
  /** Script options override */
  scriptOptions?: ScriptOptions;
  /** Signing configuration */
  signing?: SigningConfig;
  /** Environment variables to inject */
  environment?: Record<string, string>;
}

export interface ScriptExecutionResult {
  /** Script execution result */
  result: any;
  /** Execution metadata */
  metadata: {
    scriptName: string;
    network: string;
    chainId: string;
    signer: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    gasUsed?: number;
    transactionsCount?: number;
  };
  /** Performance profiling data if enabled */
  profile?: {
    phases: Array<{
      name: string;
      duration: number;
      memoryUsage?: number;
    }>;
    totalGasUsed: number;
    averageTransactionTime: number;
  };
}

/**
 * Create an enhanced script definition
 */
export function createScript<Args = Record<string, unknown>>(
  options: Script<Args>
): Script<Args> {
  return options;
}

const SUPPORTED_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".json"];
const NPM_PACKAGE_RE = /^(@[\da-z~-][\d._a-z~-]*\/)?[\da-z~-][\d._a-z~-]*($|\/.*)/;

/**
 * Run an enhanced script with full feature support
 */
export async function runScript(
  source: string,
  options: RunScriptOptions = {}
): Promise<ScriptExecutionResult> {
  const startTime = new Date();
  let network: any = null;
  let walletManager: any = null;
  let namespaceHandler: any = null;
  let context: ScriptContext<any> | null = null;

  // Normalize options
  options.cwd = resolve(process.cwd(), options.cwd || ".");
  options.scriptOptions = options.scriptOptions || {};

  // Load configuration
  if (!options.config) {
    options.config = await resolveConfig();
  }

  const scriptsDir = options.config.scriptsDir ?? "scripts";

  // Setup script loader
  const jiti = createJiti(resolve(options.cwd, scriptsDir), {
    interopDefault: true,
    moduleCache: false,
    extensions: [...SUPPORTED_EXTENSIONS],
  });

  // Resolve script path
  const scriptPath = await resolveScriptPath(source, options.cwd, scriptsDir, jiti);
  if (!scriptPath) {
    throw new Error(`Script ${source} not found`);
  }

  // Load script definition
  let scriptObject = await jiti.import(scriptPath);
  
  // Handle ES module default export
  if (scriptObject && typeof scriptObject === "object" && "default" in scriptObject) {
    scriptObject = scriptObject.default;
  }
  
  if (typeof scriptObject !== "object" || !scriptObject || typeof (scriptObject as any).run !== "function") {
    throw new Error(`Script ${source} should export an object with a run method`);
  }

  const scriptInstance = defu(scriptObject, options.scriptOptions) as Script;

  // Apply configuration overrides
  if (scriptInstance.configOverrides) {
    options.config = defu(scriptInstance.configOverrides, options.config) as Required<PactToolboxConfigObj>;
  }

  // Determine network
  options.network = options.network ?? scriptInstance.network ?? options.config.defaultNetwork;
  const chainId = options.config.networks?.[options.network]?.meta?.chainId?.toString() || "0";

  // Initialize client
  if (!options.client) {
    options.client = new PactToolboxClient(options.config, options.network);
  }
  options.client.setConfig(options.config);

  // Setup cleanup handler
  const cleanup = async () => {
    if (walletManager) {
      await walletManager.disconnect();
    }
    if (namespaceHandler) {
      await namespaceHandler.cleanup();
    }
    if (network && !scriptInstance.persist) {
      try {
        await network.stop();
        logger.info("Network stopped");
      } catch (error) {
        logger.error("Error stopping network:", error);
      }
    }
  };

  // Register cleanup
  cleanupOnExit(cleanup);

  let executionResult: any = null;
  let profile: any = undefined;

  try {
    // Start profiling if enabled
    const profiler = scriptInstance.profile ? createProfiler() : null;
    
    profiler?.start('initialization');

    // Resolve signing configuration
    const signingConfig = resolveSigningConfig(
      { ...options.args, ...options.signing },
      options.environment
    );

    // Initialize wallet manager
    walletManager = createWalletManager(options.config, signingConfig, options.network);
    await walletManager.initialize();

    // Initialize namespace handler
    namespaceHandler = createNamespaceHandler(options.client, walletManager, chainId);

    profiler?.end('initialization');
    profiler?.start('network');

    // Start network if requested
    if (scriptInstance.autoStartNetwork) {
      network = await createNetwork(options.config, {
        ...scriptInstance.startNetworkOptions,
        network: options.network,
        client: options.client,
        autoStart: true,
      });
    }

    profiler?.end('network');
    profiler?.start('context');

    // Build script context
    const contextBuilder = createScriptContextBuilder(
      options.client,
      options.config,
      options.network,
      chainId as ChainId,
      options.args || {},
      walletManager,
      namespaceHandler
    );

    context = await contextBuilder.build();

    // Inject environment variables
    if (scriptInstance.environment || options.environment) {
      Object.assign(process.env, scriptInstance.environment, options.environment);
    }

    profiler?.end('context');

    // Log script execution start
    logger.info(`🚀 Starting enhanced script: ${scriptInstance.metadata?.name || source}`);
    logger.info(`📍 Network: ${options.network} (Chain: ${chainId})`);
    logger.info(`👤 Signer: ${context.currentSigner.account}`);

    // Run pre-execution hook
    if (scriptInstance.hooks?.preRun) {
      profiler?.start('preRun');
      await scriptInstance.hooks.preRun(context);
      profiler?.end('preRun');
    }

    profiler?.start('execution');

    // Execute script with timeout
    if (scriptInstance.timeout) {
      executionResult = await Promise.race([
        scriptInstance.run(context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Script execution timeout')), scriptInstance.timeout)
        )
      ]);
    } else {
      executionResult = await scriptInstance.run(context);
    }

    profiler?.end('execution');

    // Run post-execution hook
    if (scriptInstance.hooks?.postRun) {
      profiler?.start('postRun');
      await scriptInstance.hooks.postRun(context, executionResult);
      profiler?.end('postRun');
    }

    // Generate profile data
    if (profiler) {
      profile = profiler.getProfile();
    }

    const endTime = new Date();

    // Create execution result
    const result: ScriptExecutionResult = {
      result: executionResult,
      metadata: {
        scriptName: scriptInstance.metadata?.name || source,
        network: options.network!,
        chainId,
        signer: context.currentSigner.account,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
      },
      profile
    };

    logger.success(`✅ Script completed successfully in ${result.metadata.duration}ms`);
    
    // Cleanup
    await cleanup();
    
    return result;

  } catch (error) {
    logger.error(`❌ Script execution failed:`, error);

    // Run error hook
    if (scriptInstance.hooks?.onError && context) {
      try {
        await scriptInstance.hooks.onError(context, error as Error);
      } catch (hookError) {
        logger.error("Error in onError hook:", hookError);
      }
    }

    // Cleanup
    await cleanup();
    
    throw error;
  }
}

/**
 * Resolve script path with multiple fallback strategies
 */
async function resolveScriptPath(
  source: string,
  cwd: string,
  scriptsDir: string,
  jiti: any
): Promise<string | null> {
  const tryResolve = (id: string) => {
    const resolved = jiti.esmResolve(id, { try: true });
    return resolved ? fileURLToPath(resolved) : undefined;
  };

  // Try resolving as npm package
  if (NPM_PACKAGE_RE.test(source)) {
    const resolved = tryResolve(source);
    if (resolved) return resolved;
  }

  // Try different path combinations
  const paths = [
    resolve(cwd, scriptsDir, source),
    resolve(cwd, source),
    resolve(cwd, ".scripts", source),
    resolve(cwd, "scripts", source)
  ];

  for (const path of paths) {
    const resolved = tryResolve(path);
    if (resolved) return resolved;
  }

  return null;
}

/**
 * Create a simple profiler for script execution
 */
function createProfiler() {
  const phases: Array<{ name: string; start: number; end?: number; duration?: number }> = [];
  let currentPhase: string | null = null;

  return {
    start(name: string) {
      if (currentPhase) {
        this.end(currentPhase);
      }
      phases.push({ name, start: performance.now() });
      currentPhase = name;
    },

    end(name: string) {
      const phase = phases.find(p => p.name === name && !p.end);
      if (phase) {
        phase.end = performance.now();
        phase.duration = phase.end - phase.start;
      }
      if (currentPhase === name) {
        currentPhase = null;
      }
    },

    getProfile() {
      // End current phase if any
      if (currentPhase) {
        this.end(currentPhase);
      }

      return {
        phases: phases.map(p => ({
          name: p.name,
          duration: p.duration || 0,
          memoryUsage: process.memoryUsage().heapUsed
        })),
        totalGasUsed: 0, // Gas tracking would require integration with actual transactions
        averageTransactionTime: phases.reduce((sum, p) => sum + (p.duration || 0), 0) / phases.length
      };
    }
  };
}

/**
 * List available scripts in the scripts directory
 */
export async function listScripts(cwd: string = process.cwd()): Promise<Array<{
  name: string;
  path: string;
  metadata?: any;
}>> {
  const { glob } = await import("@pact-toolbox/node-utils");
  
  const scriptsDir = resolve(cwd, "scripts");
  const result = await glob("**/*.{js,mjs,cjs,ts,mts,cts}", {
    cwd: scriptsDir,
    ignore: ["node_modules/**", "dist/**", "*.d.ts"]
  });

  const scripts = [];
  
  for (const scriptPath of result.files) {
    const fullPath = resolve(scriptsDir, scriptPath);
    const name = scriptPath.replace(/\.[^.]+$/, '');
    
    try {
      // Try to load script metadata without executing
      const jiti = createJiti(scriptsDir, { interopDefault: true });
      const scriptObject = await jiti.import(fullPath);
      
      scripts.push({
        name,
        path: fullPath,
        metadata: (scriptObject as any)?.metadata
      });
    } catch {
      scripts.push({
        name,
        path: fullPath
      });
    }
  }

  return scripts;
}

/**
 * Validate script definition
 */
export function validateScript(script: any): string[] {
  const errors: string[] = [];

  if (!script) {
    errors.push("Script is null or undefined");
    return errors;
  }

  if (typeof script.run !== "function") {
    errors.push("Script must have a 'run' function");
  }

  if (script.timeout && (typeof script.timeout !== "number" || script.timeout <= 0)) {
    errors.push("Script timeout must be a positive number");
  }

  if (script.metadata) {
    if (script.metadata.version && typeof script.metadata.version !== "string") {
      errors.push("Script metadata.version must be a string");
    }
  }

  return errors;
}

/**
 * Create default enhanced script options
 */
export function createDefaultScriptOptions(
  overrides: Partial<ScriptOptions> = {}
): ScriptOptions {
  return {
    autoStartNetwork: true,
    persist: false,
    profile: false,
    timeout: 300000, // 5 minutes
    namespaceHandling: {
      autoCreate: true,
      interactive: false
    },
    ...overrides
  };
}