import type { spinner } from "@clack/prompts";

export type Spinner = ReturnType<typeof spinner>;

export { spinner, isCancel, select, text } from "@clack/prompts";
