import type { onlineManager, Query, QueryClient } from "@tanstack/query-core";
import { createContext, useContext, type Context } from "solid-js";

type XPosition = "left" | "right";
type YPosition = "top" | "bottom";
export type DevtoolsPosition = XPosition | YPosition;
export type DevtoolsButtonPosition = `${YPosition}-${XPosition}` | "relative";

export interface DevtoolsErrorType {
  /**
   * The name of the error.
   */
  name: string;
  /**
   * How the error is initialized.
   */
  initializer: (query: Query) => Error;
}

export interface QueryDevtoolsProps {
  readonly client: QueryClient;
  queryFlavor: string;
  version: string;
  onlineManager: typeof onlineManager;

  buttonPosition?: DevtoolsButtonPosition;
  position?: DevtoolsPosition;
  initialIsOpen?: boolean;
  errorTypes?: Array<DevtoolsErrorType>;
  shadowDOMTarget?: ShadowRoot;
  onClose?: () => unknown;
}

export const QueryDevtoolsContext = createContext<QueryDevtoolsProps>({
  client: undefined as unknown as QueryClient,
  onlineManager: undefined as unknown as typeof onlineManager,
  queryFlavor: "",
  version: "",
  shadowDOMTarget: undefined,
}) satisfies Context<QueryDevtoolsProps> as Context<QueryDevtoolsProps>;

export function useQueryDevtoolsContext(): QueryDevtoolsProps {
  return useContext(QueryDevtoolsContext);
}
