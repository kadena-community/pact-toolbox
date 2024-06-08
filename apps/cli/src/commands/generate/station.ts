import { existsSync } from "fs";
import { defineCommand } from "citty";
import { join } from "pathe";

import { resolveConfig } from "@pact-toolbox/config";
import { generateGasStation } from "@pact-toolbox/fabricator";
import { logger, writeFileAtPath } from "@pact-toolbox/utils";

export const stationCommand = defineCommand({
  meta: {
    name: "station",
    description: "Generate gas station contract",
  },
  args: {
    name: {
      type: "positional",
      description: "Name of the gas station",
      valueHint: "my-gas-station",
      default: "my-gas-station",
      required: false,
    },
    namespace: {
      type: "string",
      description: "Namespace of the gas station",
      valueHint: "free",
      default: "free",
    },
    "admin-keyset": {
      type: "string",
      description: "Admin keyset for the gas station",
      valueHint: "admin-keyset",
      default: "admin-keyset",
    },
    account: {
      type: "string",
      description: "K account for the gas station",
      required: true,
      valueHint: "k:3a9dd....",
    },
    module: {
      type: "string",
      description: "Module for the gas station",
      valueHint: "my-module",
      default: "my-module",
    },
    force: {
      type: "boolean",
      description: "Force overwrite existing gas station",
      default: false,
      alias: ["f"],
    },
  },
  run: async ({ args }) => {
    // Generate gas station
    const config = await resolveConfig();
    const contractDir = config.contractsDir || "pact";
    const code = generateGasStation({
      namespace: args.namespace,
      adminKeyset: args["admin-keyset"],
      account: args.account,
      module: args.module,
      name: args.name,
    });
    const fileName = `${args.module}-${args.name}.pact`;
    const path = join(contractDir, fileName);
    if (existsSync(path) && !args.force) {
      logger.error(`Gas station ${fileName} already exists in ${contractDir} directory.`);
      return;
    }
    await writeFileAtPath(path, code);
    logger.box(
      `Gas station ${fileName} generated in ${contractDir} directory.\nPlease review the generated code before deploying it.`,
    );
  },
});
