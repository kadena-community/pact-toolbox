export { TUIManager } from "./manager";
export type {
  TUIState,
  TUIOptions,
  TUITheme,
  ProcessInfo,
  ContainerInfo,
  NetworkInfo,
  LogEntry,
  StatusInfo,
} from "./types";

// Create and export a default TUI instance
import { TUIManager } from "./manager";
export const tui = new TUIManager();