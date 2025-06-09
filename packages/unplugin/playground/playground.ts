import { Bench } from "tinybench";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createPactToJSTransformer } from "../src/transformer";
import { contractParser, generateDts } from "@kadena/pactjs-generator";

const bench = new Bench({
  warmup: true,
  iterations: 1000,
});
const pactCode = readFileSync(join(process.cwd(), "playground", "code.pact"), "utf8");

bench.add("@pact-toolbox/unplugin", () => {
  const transform = createPactToJSTransformer();
  const { code } = transform(pactCode);
  return code;
});

bench.add("@kadena/pactjs-generator", () => {
  const [modules] = contractParser(pactCode);
  let code = "";
  for (const module of modules) {
    code += generateDts(module);
  }
  return code;
});

await bench.run();
console.table(bench.table());
