import { Bench } from "tinybench";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createPactToJSTransformer } from "../dist/transform";
import { contractParser, generateDts } from "@kadena/pactjs-generator";

const bench = new Bench({
  warmup: true,
  iterations: 1000,
});
const pactCode = readFileSync(join(process.cwd(), "playground", "code.pact"), "utf8");

bench.add("@pact-toolbox/unplugin", async () => {
  const transform = createPactToJSTransformer();
  const { code } = await transform(pactCode);
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

const results = await bench.run();
const fastest = results[0]!;
const slowest = results[results.length - 1]!;
const fastestLatency = fastest.result?.latency.mean ?? 0;
const slowestLatency = slowest.result?.latency.mean ?? 0;

console.log(`${fastest.name} - ${fastestLatency}ms is ${(slowestLatency / fastestLatency).toFixed(2)}x faster`);

console.table(bench.table());
