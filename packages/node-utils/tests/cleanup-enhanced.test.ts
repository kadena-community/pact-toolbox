import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("cleanup enhanced features", () => {
  let _processExitSpy: any;
  let processOnSpy: any;
  let eventHandlers: Map<string, Function>;

  beforeEach(() => {
    // Reset modules to clear any cached imports
    vi.resetModules();

    // Reset event handlers map
    eventHandlers = new Map();

    // Mock process.exit
    _processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
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

  it("should respect cleanup function priorities", async () => {
    const { cleanupOnExit } = await import("../src/cleanup");
    const execution_order: string[] = [];

    // Register functions in reverse priority order
    cleanupOnExit(
      () => {
        execution_order.push("low");
      },
      { name: "low", priority: 1 },
    );
    cleanupOnExit(
      () => {
        execution_order.push("high");
      },
      { name: "high", priority: 10 },
    );
    cleanupOnExit(
      () => {
        execution_order.push("medium");
      },
      { name: "medium", priority: 5 },
    );

    // Get the SIGINT handler
    const sigintHandler = eventHandlers.get("SIGINT");
    expect(sigintHandler).toBeDefined();

    // Trigger the handler
    try {
      await sigintHandler!();
    } catch {
      // Expected due to process.exit mock
    }

    // Should execute in priority order: high, medium, low
    expect(execution_order).toEqual(["high", "medium", "low"]);
  });

  it("should timeout individual cleanup functions", async () => {
    const { cleanupOnExit } = await import("../src/cleanup");

    const slowFunction = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)));
    const fastFunction = vi.fn().mockResolvedValue(undefined);

    // Register slow function with short timeout
    cleanupOnExit(slowFunction, { name: "slow", timeout: 100 });
    cleanupOnExit(fastFunction, { name: "fast" });

    // Get the SIGINT handler
    const sigintHandler = eventHandlers.get("SIGINT");
    expect(sigintHandler).toBeDefined();

    // Trigger the handler
    try {
      await sigintHandler!();
    } catch {
      // Expected due to process.exit mock
    }

    expect(slowFunction).toHaveBeenCalled();
    expect(fastFunction).toHaveBeenCalled();
  });

  it("should handle new signals SIGUSR1 and SIGUSR2", async () => {
    const { cleanupOnExit } = await import("../src/cleanup");
    const cleanupFn = vi.fn().mockResolvedValue(undefined);
    cleanupOnExit(cleanupFn);

    // Check that new signals were registered
    const registeredSignals = processOnSpy.mock.calls.map((call: any[]) => call[0]);

    expect(registeredSignals).toContain("SIGUSR1");
    expect(registeredSignals).toContain("SIGUSR2");
  });

  it("should provide unregister functionality", async () => {
    const { cleanupOnExit, unregisterCleanup } = await import("../src/cleanup");
    const cleanupFn1 = vi.fn().mockResolvedValue(undefined);
    const cleanupFn2 = vi.fn().mockResolvedValue(undefined);

    cleanupOnExit(cleanupFn1, { name: "fn1" });
    cleanupOnExit(cleanupFn2, { name: "fn2" });

    // Unregister one function
    unregisterCleanup(cleanupFn1);

    // Get the SIGINT handler
    const sigintHandler = eventHandlers.get("SIGINT");
    expect(sigintHandler).toBeDefined();

    // Trigger the handler
    try {
      await sigintHandler!();
    } catch {
      // Expected due to process.exit mock
    }

    // Only fn2 should be called
    expect(cleanupFn1).not.toHaveBeenCalled();
    expect(cleanupFn2).toHaveBeenCalled();
  });

  it("should warn about async functions during synchronous exit", async () => {
    const { cleanupOnExit } = await import("../src/cleanup");
    const asyncFn = vi.fn().mockResolvedValue(undefined);
    const syncFn = vi.fn();

    cleanupOnExit(asyncFn, { name: "async" });
    cleanupOnExit(syncFn, { name: "sync" });

    // Get the exit handler (synchronous)
    const exitHandler = eventHandlers.get("exit");
    expect(exitHandler).toBeDefined();

    // Trigger the exit handler
    try {
      await exitHandler!(0);
    } catch {
      // Expected due to process.exit mock
    }

    // Both should be called, but async will generate warning
    expect(asyncFn).toHaveBeenCalled();
    expect(syncFn).toHaveBeenCalled();
  });
});
