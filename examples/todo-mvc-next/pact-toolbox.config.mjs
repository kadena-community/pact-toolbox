import { join } from "path";
import { defineConfig } from "pact-toolbox";

export default defineConfig({
  // defaultNetwork: "devnetOnDemand",
  extends: "../../pact-toolbox.config.mjs",
  contractsDir: join(process.cwd(), "../todo-mvc-common/pact"),
});
