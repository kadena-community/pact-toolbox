import react from "@vitejs/plugin-react-swc";
import { mergeConfig } from "vitest/config";

import node from "./node.js";

export default mergeConfig(node, {
  plugins: [react()],
  test: {
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    environment: "happy-dom",
  },
});
