/**
 * @fileoverview Tests for the main CLI
 */

import { describe, it, expect, vi } from "vitest";

// Mock citty to prevent CLI execution during tests
const mockDefineCommand = vi.fn();
const mockRunMain = vi.fn();

vi.mock("citty", () => ({
  defineCommand: mockDefineCommand,
  runMain: mockRunMain,
}));

// Mock package.json
vi.mock("../package.json", () => ({
  default: {
    version: "0.3.0",
    name: "pact-toolbox",
  },
}));

describe("CLI", () => {
  it("should define main command with correct metadata", async () => {
    // Import the CLI to trigger command definition
    await import("./cli");

    expect(mockDefineCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          name: "pact-toolbox",
          description: expect.stringContaining("comprehensive toolkit"),
          version: "0.3.0",
        }),
        subCommands: expect.objectContaining({
          doctor: expect.any(Function),
          init: expect.any(Function),
          start: expect.any(Function),
          prelude: expect.any(Function),
          run: expect.any(Function),
          test: expect.any(Function),
          generate: expect.any(Function),
        }),
      }),
    );
  });

  it("should successfully import without errors", async () => {
    // Just test that the CLI can be imported without throwing
    const cli = await import("./cli");
    expect(cli).toBeDefined();
  });
});
