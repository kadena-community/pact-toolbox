import type { Accessor, Context } from "solid-js";
import { createContext, useContext } from "solid-js";

export const ThemeContext = createContext<Accessor<"light" | "dark">>(() => "dark" as const) satisfies Context<Accessor<"light" | "dark">> as Context<Accessor<"light" | "dark">>;

export function useTheme(): Accessor<"light" | "dark"> {
  return useContext(ThemeContext);
}
