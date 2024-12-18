import { installEd25519Polyfill } from "./polyfill";

installEd25519Polyfill();

export * from "./address";
export * from "./assertions";
export * from "./codecs";
export * from "./hash";
export * from "./keys";
export * from "./polyfill";
export * from "./stringify";
