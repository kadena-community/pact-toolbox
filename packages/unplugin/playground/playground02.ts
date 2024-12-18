import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractParser, generateDts } from "@kadena/pactjs-generator";

const pactCode = readFileSync(join(process.cwd(), "playground", "code.pact"), "utf8");
console.time("time");
const [modules] = contractParser(pactCode);
let code = "";
for (const module of modules) {
  code += generateDts(module);
}
console.timeEnd("time");
