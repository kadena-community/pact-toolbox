import { 
  transformPactToJs, 
  warmUpParserPool, 
  type TransformationResult as RustTransformationResult,
  type TransformOptions 
} from "@pact-toolbox/pact-transformer";

interface PactModule {
  name: string;
  path: string;
}

interface TransformationResult {
  modules: PactModule[];
  code: string;
  types: string;
}

type PactToJSTransformer = (pactCode: string) => Promise<TransformationResult>;

interface PactToJSTransformerOptions extends TransformOptions {
  debug?: boolean;
}

export function createPactToJSTransformer({ debug, generateTypes = true, moduleName }: PactToJSTransformerOptions = {}): PactToJSTransformer {
  // Warm up the parser pool for better performance
  warmUpParserPool();
  
  const transform = async (pactCode: string): Promise<TransformationResult> => {
    try {
      const result: RustTransformationResult = await transformPactToJs(pactCode, {
        generateTypes,
        moduleName,
      });
      
      return {
        modules: result.modules.map((m) => ({
          name: m.name,
          path: m.name, // Use module name as path since the Rust transformer doesn't have path
        })),
        code: result.code,
        types: result.types,
      };
    } catch (error) {
      throw new Error(`Pact transformation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return transform;
}
