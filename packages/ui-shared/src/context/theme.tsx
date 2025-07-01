import { createContext, useContext, createSignal, createEffect, JSX, onCleanup } from "solid-js";
import { lightTheme, darkTheme } from "../styles/themes";

export type Theme = "light" | "dark" | "auto";

interface ThemeContextValue {
  theme: () => Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: () => "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue>();

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

interface ThemeProviderProps {
  theme?: Theme;
  children: JSX.Element;
}

export function ThemeProvider(props: ThemeProviderProps) {
  const [internalTheme, setInternalTheme] = createSignal<Theme>(props.theme || "auto");
  const [systemTheme, setSystemTheme] = createSignal<"light" | "dark">("light");

  // Use props.theme if provided, otherwise use internal state
  const theme = () => props.theme !== undefined ? props.theme : internalTheme();

  // Detect system theme preference
  createEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemTheme(mediaQuery.matches ? "dark" : "light");

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    onCleanup(() => mediaQuery.removeEventListener("change", handleChange));
  });

  const resolvedTheme = () => {
    const currentTheme = theme();
    return currentTheme === "auto" ? systemTheme() : currentTheme;
  };

  // Apply theme class to root element
  createEffect(() => {
    const resolved = resolvedTheme();
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove(lightTheme, darkTheme);

    // Add appropriate theme class
    root.classList.add(resolved === "dark" ? darkTheme : lightTheme);

    // Also set data attribute for CSS selectors if needed
    root.setAttribute("data-theme", resolved);
  });

  const setTheme = (newTheme: Theme) => {
    if (props.theme === undefined) {
      setInternalTheme(newTheme);
    }
  };

  const value: ThemeContextValue = {
    theme,
    setTheme,
    resolvedTheme,
  };

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}