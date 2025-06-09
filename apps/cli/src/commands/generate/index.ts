import { defineCommand } from "citty";

export const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate contracts and components",
  },
  subCommands: {
    station: async () => (await import("./station")).stationCommand,
    module: async () => (await import("./module")).moduleCommand,
  },
});
