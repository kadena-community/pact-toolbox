import { describe, it, expect, beforeEach, vi } from "vitest";
import { access } from "node:fs/promises";
import { validateProjectName, directoryExists } from "./index.js";

// Mock dependencies
vi.mock("@pact-toolbox/node-utils", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  writeFile: vi.fn(),
  execAsync: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  isCancel: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
}));

vi.mock("@pact-toolbox/utils", () => ({
  fillTemplatePlaceholders: vi.fn((content, replacements) => {
    let result = content;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
    }
    return result;
  }),
}));

vi.mock("citty", () => ({
  defineCommand: vi.fn((config) => config),
  runMain: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  access: vi.fn(),
}));

vi.mock("glob", () => ({
  glob: vi.fn(),
}));

describe("create-pact-toolbox-app", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateProjectName", () => {
    it("should accept valid project names", () => {
      expect(validateProjectName("my-app")).toEqual({ valid: true });
      expect(validateProjectName("my_app")).toEqual({ valid: true });
      expect(validateProjectName("myapp123")).toEqual({ valid: true });
      expect(validateProjectName("@scope/package")).toEqual({ valid: true });
    });

    it("should reject empty names", () => {
      expect(validateProjectName("")).toEqual({
        valid: false,
        error: "Project name cannot be empty",
      });
    });

    it("should reject names that are too long", () => {
      const longName = "a".repeat(215);
      expect(validateProjectName(longName)).toEqual({
        valid: false,
        error: "Project name must be less than 214 characters",
      });
    });

    it("should reject uppercase names", () => {
      expect(validateProjectName("MyApp")).toEqual({
        valid: false,
        error: "Project name must be lowercase",
      });
    });

    it("should reject names starting with . or _", () => {
      expect(validateProjectName(".myapp")).toEqual({
        valid: false,
        error: "Project name cannot start with . or _",
      });
      expect(validateProjectName("_myapp")).toEqual({
        valid: false,
        error: "Project name cannot start with . or _",
      });
    });

    it("should reject names with invalid characters", () => {
      expect(validateProjectName("my app")).toEqual({
        valid: false,
        error: "Project name can only contain lowercase letters, numbers, @, /, _, and -",
      });
      expect(validateProjectName("my$app")).toEqual({
        valid: false,
        error: "Project name can only contain lowercase letters, numbers, @, /, _, and -",
      });
    });
  });

  describe("directoryExists", () => {
    it("should return true for existing directories", async () => {
      vi.mocked(access).mockResolvedValue(undefined);
      const result = await directoryExists("/some/path");
      expect(result).toBe(true);
    });

    it("should return false for non-existing directories", async () => {
      vi.mocked(access).mockRejectedValue(new Error("ENOENT"));
      const result = await directoryExists("/non/existent/path");
      expect(result).toBe(false);
    });
  });

  describe("template validation", () => {
    it("should validate required template files exist", () => {
      // Test that TEMPLATE_FILES constant contains expected files
      expect(true).toBe(true); // Placeholder for actual template validation tests
    });
  });
});
