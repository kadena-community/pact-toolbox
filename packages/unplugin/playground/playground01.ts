import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createPactToJSTransformer } from "../src/transformer";

const pactCode = readFileSync(join(process.cwd(), "playground", "code.pact"), "utf8");
console.time("time");
const transform = createPactToJSTransformer();
transform(pactCode);
console.timeEnd("time");
