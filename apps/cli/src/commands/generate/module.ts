import { existsSync } from "fs";
import { defineCommand } from "citty";
import { join } from "pathe";

import { resolveConfig } from "@pact-toolbox/config";
import { generateModule } from "@pact-toolbox/fabricator";
import { logger, writeFileAtPath } from "@pact-toolbox/utils";

export const moduleCommand = defineCommand({
  meta: {
    name: "module",
    description: "Generate contracts and components",
  },
  args: {
    name: {
      type: "positional",
      description: "Name of the module",
      valueHint: "my-module",
      required: true,
    },
    namespace: {
      type: "string",
      description: "Namespace of the module",
      valueHint: "free",
      default: "free",
    },
    "admin-keyset": {
      type: "string",
      description: "Admin keyset of the module",
      valueHint: "admin-keyset",
      default: "admin-keyset",
    },
    force: {
      type: "boolean",
      description: "Force overwrite existing module",
      default: false,
      alias: ["f"],
    },
  },
  run: async ({ args }) => {
    const config = await resolveConfig();
    const contractDir = config.contractsDir || "pact";
    const code = generateModule({
      namespace: args.namespace,
      adminKeyset: args["admin-keyset"],
      name: args.name,
    });
    const fileName = `${args.name}.pact`;
    const path = join(contractDir, fileName);
    if (existsSync(path) && !args.force) {
      logger.error(`Module ${fileName} already exists in ${contractDir} directory.`);
      return;
    }
    await writeFileAtPath(path, code);
    logger.box(
      `Module ${fileName} generated in ${contractDir} directory.\nPlease review the generated code before deploying it.`,
    );
  },
});
