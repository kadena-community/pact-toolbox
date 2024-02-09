import { defineCommand } from "citty";
import { upgradePact } from "../../../../packages/installer/src/pactInstaller";

export const upgradeCommand = defineCommand({
  meta: {
    name: "upgrade",
    description: "Upgrade Pact",
  },
  run: upgradePact,
});
