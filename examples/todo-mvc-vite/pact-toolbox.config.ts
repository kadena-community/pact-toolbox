import { join } from "path";
import { defineConfig } from "pact-toolbox";

export default defineConfig({
  // defaultNetwork: "devnetOnDemand",
  extends: "../../pact-toolbox.config.ts",
  contractsDir: join(process.cwd(), "../todo-mvc-common/pact"),
});
