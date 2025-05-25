import { defineConfig } from "pact-toolbox";
import { join } from "path";

export default defineConfig({
  defaultNetwork: "devnet",
  extends: "../../pact-toolbox.config.mjs",
  contractsDir: join(process.cwd(), "../todo-mvc-common/pact"),
});
