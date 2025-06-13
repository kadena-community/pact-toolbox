import { createConsola, type ConsolaInstance } from "consola";

export const logger: ConsolaInstance = createConsola({
  level: 4,
  formatOptions: {
    columns: 80,
    colors: false,
    compact: false,
    date: false,
  },
});

export type Logger = ConsolaInstance;
export { LogLevels } from "consola";
