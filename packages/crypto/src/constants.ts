// Check if the code is running in a browser environment
export const __BROWSER__: boolean = typeof window !== "undefined" && typeof window.document !== "undefined";

// Check if the code is running in a Node.js environment
export const __NODEJS__: boolean =
  typeof process !== "undefined" && process.versions != null && process.versions.node != null;

// Check if the current environment is a development environment
export const __DEV__: boolean = typeof process !== "undefined" && process.env.NODE_ENV !== "production";
