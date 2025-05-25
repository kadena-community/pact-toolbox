import { install } from "./polyfill";

if (!__NODEJS__) {
  install();
}

export * from "./address";
export * from "./assertions";
export * from "./codecs";
export * from "./hash";
export * from "./keys";
export * from "./stringify";
