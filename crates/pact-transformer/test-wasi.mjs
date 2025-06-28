import { readFileSync } from "node:fs";
import { WASI } from "wasi";
import { argv } from "node:process";

const wasi = new WASI({
  version: "preview1",
  args: argv,
  env: process.env,
});

const wasm = await WebAssembly.compile(readFileSync("./pact-transformer.wasm32-wasip1-threads.wasm"));

const instance = await WebAssembly.instantiate(wasm, wasi.getImportObject());

wasi.start(instance);

// Basic test to verify WASI module loads
console.log("WASI module loaded successfully");

// Add more specific tests here based on your module's exports
if (instance.exports.parse) {
  console.log("parse function found");
}

if (instance.exports.transform) {
  console.log("transform function found");
}
