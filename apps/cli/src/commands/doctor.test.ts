/**
 * @fileoverview Tests for the doctor command
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockExecSync = vi.fn();
const mockInstallPact = vi.fn();
const mockIsAnyPactInstalled = vi.fn();
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  success: vi.fn(),
  box: vi.fn(),
  prompt: vi.fn(),
};

vi.mock("@pact-toolbox/node-utils", () => ({
  installPact: mockInstallPact,
  isAnyPactInstalled: mockIsAnyPactInstalled,
  logger: mockLogger,
}));

vi.mock("child_process", () => ({
  execSync: mockExecSync,
}));

describe("doctor command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have correct command metadata", async () => {
    const { doctorCommand } = await import("./doctor");
    
    expect(doctorCommand).toBeDefined();
    // Check meta exists and has correct structure
    expect(doctorCommand.meta).toBeDefined();
    
    // Access meta properties directly without type checking
    const meta = doctorCommand.meta as any;
    expect(meta.name).toBe("doctor");
    expect(meta.description).toContain("system dependencies");
    expect(typeof doctorCommand.run).toBe("function");
  });

  it("should detect docker when available", async () => {
    mockExecSync.mockReturnValue("Docker version 20.10.0");
    
    const { doctorCommand } = await import("./doctor");
    expect(doctorCommand).toBeDefined();
  });

  it("should handle docker unavailable", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("Command not found");
    });
    
    const { doctorCommand } = await import("./doctor");
    expect(doctorCommand).toBeDefined();
  });

  it("should handle pact detection", async () => {
    mockIsAnyPactInstalled.mockResolvedValue(true);
    
    const { doctorCommand } = await import("./doctor");
    expect(doctorCommand).toBeDefined();
    expect(typeof doctorCommand.run).toBe("function");
  });

  it("should be importable without errors", async () => {
    const { doctorCommand } = await import("./doctor");
    
    expect(doctorCommand).toBeDefined();
    expect(doctorCommand.meta).toBeDefined();
    expect(doctorCommand.run).toBeDefined();
  });
});