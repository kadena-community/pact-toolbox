import { generateModuleCode } from "./codeGenerator";
import { PactTransformer } from "./transformer";

interface PactModule {
  name: string;
  path: string;
}
interface TransformationResult {
  modules: PactModule[];
  code: string;
  types: string;
}

type PactToJSTransformer = (pactCode: string) => TransformationResult;
interface PactToJSTransformerOptions {
  debug?: boolean;
}
export function createPactToJSTransformer({ debug }: PactToJSTransformerOptions = {}): PactToJSTransformer {
  const transformer = new PactTransformer();
  const transform = (pactCode: string): TransformationResult => {
    const modules = transformer.transform(pactCode);
    let code = "";
    let types = "";
    for (const module of modules) {
      const { code: moduleCode, types: moduleTypes } = generateModuleCode(module, debug);
      code += moduleCode + "\n";
      types += moduleTypes + "\n";
    }
    return {
      modules: modules.map((m) => ({
        name: m.name,
        path: m.path,
      })),
      code,
      types,
    };
  };

  return transform;
}
