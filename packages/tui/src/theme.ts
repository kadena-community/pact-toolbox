import type { TUITheme } from "./types";

export const defaultTheme: TUITheme = {
  colors: {
    primary: "#3b82f6",    // Blue
    secondary: "#6366f1",  // Indigo
    success: "#10b981",    // Emerald
    warning: "#f59e0b",    // Amber
    error: "#ef4444",      // Red
    info: "#06b6d4",       // Cyan
    muted: "#6b7280",      // Gray
    background: "#111827", // Dark gray
    foreground: "#f9fafb", // Light gray
  },
  symbols: {
    success: "✓",
    error: "✗",
    warning: "⚠",
    info: "ℹ",
    running: "●",
    stopped: "○",
    loading: "◐",
    arrow: "→",
    bullet: "•",
  },
  borders: {
    single: ["┌", "┐", "└", "┘", "─", "│", "├", "┤", "┬", "┴", "┼"],
    double: ["╔", "╗", "╚", "╝", "═", "║", "╠", "╣", "╦", "╩", "╬"],
    rounded: ["╭", "╮", "╰", "╯", "─", "│", "├", "┤", "┬", "┴", "┼"],
  },
};

export const lightTheme: TUITheme = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    background: "#ffffff",
    foreground: "#1f2937",
    muted: "#9ca3af",
  },
};

export const minimalTheme: TUITheme = {
  ...defaultTheme,
  symbols: {
    success: "+",
    error: "-",
    warning: "!",
    info: "i",
    running: "*",
    stopped: " ",
    loading: "~",
    arrow: ">",
    bullet: "-",
  },
  borders: {
    single: ["+", "+", "+", "+", "-", "|", "+", "+", "+", "+", "+"],
    double: ["+", "+", "+", "+", "=", "|", "+", "+", "+", "+", "+"],
    rounded: ["+", "+", "+", "+", "-", "|", "+", "+", "+", "+", "+"],
  },
};

export function createDefaultTheme(overrides?: Partial<TUITheme>): TUITheme {
  if (!overrides) return defaultTheme;

  return {
    colors: { ...defaultTheme.colors, ...overrides.colors },
    symbols: { ...defaultTheme.symbols, ...overrides.symbols },
    borders: { ...defaultTheme.borders, ...overrides.borders },
  };
}