import { generateModuleCode } from "./codeGenerator";
import { PactTransformer } from "./transformer";

interface TransformationResult {
  modules: string[];
  code: string;
  types: string;
}

type PactToJSTransformer = (pactCode: string) => TransformationResult;
export function createPactToJSTransformer(): PactToJSTransformer {
  const transformer = new PactTransformer();
  const transform = (pactCode: string): TransformationResult => {
    const modules = transformer.transform(pactCode);
    let code = "";
    let types = "";
    for (const module of modules) {
      const { code: moduleCode, types: moduleTypes } = generateModuleCode(module);
      code += moduleCode + "\n";
      types += moduleTypes + "\n";
    }
    return {
      modules: modules.map((m) => m.name),
      code,
      types,
    };
  };

  return transform;
}
