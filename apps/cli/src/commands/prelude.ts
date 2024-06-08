import { defineCommand } from "citty";
import { join } from "pathe";

import { resolveConfig } from "@pact-toolbox/config";
import { downloadPreludes } from "@pact-toolbox/prelude";
import { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger } from "@pact-toolbox/utils";

export const preludeCommand = defineCommand({
  meta: {
    name: "download",
    description: "Download configured preludes",
  },
  run: async () => {
    const config = await resolveConfig();
    const client = new PactToolboxClient(config);
    const start = performance.now();
    await downloadPreludes({
      client,
      contractsDir: config.contractsDir ?? "pact",
      preludes: config.preludes ?? [],
    });
    const end = performance.now();
    logger.box(
      `All preludes downloaded successfully in ${Math.round(end - start) / 1000}s 🎉\nYou can load them in repl from ${join(process.cwd(), config.contractsDir ?? "", "prelude", "init.repl")}`,
    );
  },
});
