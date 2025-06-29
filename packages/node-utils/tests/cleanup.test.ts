import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("cleanup", () => {
  let processExitSpy: any;
  let processOnSpy: any;
  let eventHandlers: Map<string, Function>;

  beforeEach(() => {
    // Reset modules to clear any cached imports
    vi.resetModules();

    // Reset event handlers map
    eventHandlers = new Map();

    // Mock process.exit
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    // Mock process.on to capture event handlers
    processOnSpy = vi.spyOn(process, "on").mockImplementation((event: string | symbol, handler: Function) => {
      eventHandlers.set(event.toString(), handler);
      return process;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    eventHandlers.clear();
  });

  it("should register cleanup function", async () => {
    const { cleanupOnExit } = await import("../src/cleanup");
    const cleanupFn = vi.fn();
    cleanupOnExit(cleanupFn);

    // Check that signal handlers were registered
    expect(processOnSpy).toHaveBeenCalled();
    const registeredSignals = processOnSpy.mock.calls.map((call: any[]) => call[0]);

    expect(registeredSignals).toContain("SIGINT");
    expect(registeredSignals).toContain("SIGTERM");
    expect(registeredSignals).toContain("exit");
  });

  it("should execute cleanup functions on exit signal", async () => {
    const { cleanupOnExit } = await import("../src/cleanup");
    const cleanupFn1 = vi.fn().mockResolvedValue(undefined);
    const cleanupFn2 = vi.fn().mockResolvedValue(undefined);

    cleanupOnExit(cleanupFn1);
    cleanupOnExit(cleanupFn2);

    // Get the exit handler
    const exitHandler = eventHandlers.get("exit");
    expect(exitHandler).toBeDefined();

    // Trigger the exit handler
    try {
      await exitHandler!(0);
    } catch {
      // Expected due to process.exit mock
    }

    expect(cleanupFn1).toHaveBeenCalled();
    expect(cleanupFn2).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it("should handle errors in cleanup functions gracefully", async () => {
    const { cleanupOnExit } = await import("../src/cleanup");
    const errorFn = vi.fn().mockRejectedValue(new Error("Cleanup error"));
    const successFn = vi.fn().mockResolvedValue(undefined);

    cleanupOnExit(errorFn);
    cleanupOnExit(successFn);

    // Get the exit handler
    const exitHandler = eventHandlers.get("exit");
    expect(exitHandler).toBeDefined();

    // Trigger the exit handler
    try {
      await exitHandler!(0);
    } catch {
      // Expected due to process.exit mock
    }

    // Both functions should be called despite error
    expect(errorFn).toHaveBeenCalled();
    expect(successFn).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it("should handle uncaught exceptions", async () => {
    const { cleanupOnExit } = await import("../src/cleanup");
    const cleanupFn = vi.fn().mockResolvedValue(undefined);
    cleanupOnExit(cleanupFn);

    // Get the uncaughtException handler
    const uncaughtHandler = eventHandlers.get("uncaughtException");
    expect(uncaughtHandler).toBeDefined();

    const testError = new Error("Test uncaught exception");

    // Trigger the handler
    try {
      await uncaughtHandler!(testError);
    } catch {
      // Expected due to process.exit mock
    }

    expect(cleanupFn).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("should prevent re-entry during cleanup", async () => {
    const { cleanupOnExit } = await import("../src/cleanup");
    const cleanupFn = vi.fn().mockImplementation(async () => {
      // Try to trigger another exit during cleanup
      const exitHandler = eventHandlers.get("exit");
      if (exitHandler) {
        await exitHandler(0);
      }
    });

    cleanupOnExit(cleanupFn);

    // Get the exit handler
    const exitHandler = eventHandlers.get("exit");
    expect(exitHandler).toBeDefined();

    // Trigger the exit handler
    try {
      await exitHandler!(0);
    } catch {
      // Expected due to process.exit mock
    }

    // Cleanup function should only be called once despite re-entry attempt
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it("should register handlers only once", async () => {
    const { cleanupOnExit } = await import("../src/cleanup");
    const cleanupFn1 = vi.fn();
    const cleanupFn2 = vi.fn();

    cleanupOnExit(cleanupFn1);
    const firstCallCount = processOnSpy.mock.calls.length;

    cleanupOnExit(cleanupFn2);
    const secondCallCount = processOnSpy.mock.calls.length;

    // No new signal handlers should be registered
    expect(secondCallCount).toBe(firstCallCount);
  });
});
