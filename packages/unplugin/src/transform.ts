import {
  createPactTransformer,
  type PactTransformer,
  type TransformResult,
  type TransformOptions,
  type ModuleInfo,
} from "@pact-toolbox/pact-transformer";
import { logger, cleanupOnExit } from "@pact-toolbox/node-utils";

interface PactModule {
  name: string;
  path: string;
}

interface TransformationResult {
  modules: PactModule[];
  code: string;
  types: string;
  sourceMap?: string;
  declarationMap?: string;
}

type PactToJSTransformer = (pactCode: string, filePath?: string) => Promise<TransformationResult>;

interface PactToJSTransformerOptions extends TransformOptions {
  debug?: boolean;
}

// Global PactTransformer instance pool for better performance
const pactToolboxPool: PactTransformer[] = [];
const MAX_POOL_SIZE = 4;

// Register transformer cleanup on process exit
let cleanupRegistered = false;
function registerTransformerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  cleanupOnExit(
    () => {
      cleanupTransformer();
    },
    {
      name: "pact-transformer-pool",
      priority: 5, // Medium priority
      timeout: 5000,
    },
  );
}

function getPactTransformer(): PactTransformer {
  return (
    pactToolboxPool.pop() ||
    createPactTransformer({
      transform: {
        generateTypes: true,
        sourceMaps: true,
      },
    })
  );
}

function returnPactTransformer(instance: PactTransformer): void {
  if (pactToolboxPool.length < MAX_POOL_SIZE) {
    pactToolboxPool.push(instance);
  }
}

export function createPactToJSTransformer({
  debug = false,
  generateTypes = true,
  moduleName,
}: PactToJSTransformerOptions = {}): PactToJSTransformer {
  // Register transformer cleanup on first use
  registerTransformerCleanup();
  const transform = async (pactCode: string, filePath?: string): Promise<TransformationResult> => {
    const pactToolbox = getPactTransformer();
    const startTime = debug ? performance.now() : 0;

    try {
      // Transform the code using the new API
      const result: TransformResult = await pactToolbox.transform(pactCode, {
        generateTypes,
        moduleName,
        sourceMaps: Boolean(filePath),
        sourceFilePath: filePath,
      });

      // Parse modules to get module information
      let modules: ModuleInfo[];
      try {
        modules = pactToolbox.parse(pactCode);
      } catch (parseError) {
        logger.warn(`Failed to parse modules from ${filePath || "unknown"}: ${parseError}`);
        modules = [];
      }

      if (debug) {
        const elapsed = performance.now() - startTime;
        logger.debug(`Transformed ${filePath || "pact code"} in ${elapsed.toFixed(2)}ms`);
      }

      return {
        modules: modules.map((m) => ({
          name: m.name,
          path: m.namespace ? `${m.namespace}.${m.name}` : m.name,
        })),
        code: result.javascript,
        types: result.typescript || "",
        sourceMap: result.sourceMap,
        declarationMap: result.declarationMap,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Provide more specific error messages based on common patterns
      if (errorMessage.includes("parse error") || errorMessage.includes("syntax error")) {
        throw new Error(`Syntax error in Pact code${filePath ? ` (${filePath})` : ""}: ${errorMessage}`);
      } else if (errorMessage.includes("transform")) {
        throw new Error(`Failed to transform Pact code${filePath ? ` (${filePath})` : ""}: ${errorMessage}`);
      } else {
        throw new Error(`Pact transformation failed${filePath ? ` for ${filePath}` : ""}: ${errorMessage}`);
      }
    } finally {
      // Return the instance to the pool
      returnPactTransformer(pactToolbox);
    }
  };

  return transform;
}

// Cleanup function for graceful shutdown
export function cleanupTransformer(): void {
  pactToolboxPool.length = 0;
}
