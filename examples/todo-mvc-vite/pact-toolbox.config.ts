import { defineConfig } from "pact-toolbox";
import { join } from "path";

export default defineConfig({
  defaultNetwork: "pactServer",
  extends: "../../pact-toolbox.config.mjs",
  contractsDir: join(process.cwd(), "../todo-mvc-common/pact"),
});
