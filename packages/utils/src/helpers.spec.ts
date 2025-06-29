import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { delay, pollFn, TimeoutError, AbortError } from "./helpers";

describe("helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("delay", () => {
    it("should resolve after specified time", async () => {
      const promise = delay(1000);

      // Should not be resolved immediately
      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(500);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(500);
      expect(resolved).toBe(true);
    });

    it("should be cancellable with AbortSignal", async () => {
      const controller = new AbortController();
      const promise = delay(1000, controller.signal);

      // Set up expectation before aborting
      const expectation = expect(promise).rejects.toThrow(AbortError);

      // Abort after 500ms
      setTimeout(() => controller.abort(), 500);

      await vi.advanceTimersByTimeAsync(500);

      await expectation;
    });

    it("should reject immediately if signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const promise = delay(1000, controller.signal);

      await expect(promise).rejects.toThrow(AbortError);
    });

    it("should clean up event listener after resolving", async () => {
      const controller = new AbortController();
      const removeEventListenerSpy = vi.spyOn(controller.signal, "removeEventListener");

      const promise = delay(100, controller.signal);

      await vi.advanceTimersByTimeAsync(100);
      await promise;

      expect(removeEventListenerSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    });
  });

  describe("pollFn", () => {
    it("should resolve when function returns true", async () => {
      const fn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const promise = pollFn(fn, { timeout: 1000, interval: 100 });

      await vi.advanceTimersByTimeAsync(250);
      await promise;

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should throw TimeoutError when timeout is reached", async () => {
      const fn = vi.fn().mockResolvedValue(false);

      const promise = pollFn(fn, { timeout: 500, interval: 100 });

      // Set up expectation before timeout
      const expectation = expect(promise).rejects.toThrow(TimeoutError);

      await vi.advanceTimersByTimeAsync(600);

      await expectation;
      expect(fn).toHaveBeenCalledTimes(5); // Called at 0, 100, 200, 300, 400ms
    });

    it("should respect custom interval", async () => {
      const fn = vi.fn().mockResolvedValue(false);

      // Start polling
      pollFn(fn, { timeout: 1000, interval: 250 });

      await vi.advanceTimersByTimeAsync(600);

      expect(fn).toHaveBeenCalledTimes(3); // Called at 0, 250, 500ms
    });

    it("should be cancellable with AbortSignal", async () => {
      const fn = vi.fn().mockResolvedValue(false);
      const controller = new AbortController();

      const promise = pollFn(fn, {
        timeout: 1000,
        interval: 100,
        signal: controller.signal,
      });

      await vi.advanceTimersByTimeAsync(250);
      controller.abort();

      await expect(promise).rejects.toThrow(AbortError);
    });

    it("should throw immediately if signal is already aborted", async () => {
      const fn = vi.fn().mockResolvedValue(false);
      const controller = new AbortController();
      controller.abort();

      const promise = pollFn(fn, {
        timeout: 1000,
        signal: controller.signal,
      });

      await expect(promise).rejects.toThrow(AbortError);
      expect(fn).not.toHaveBeenCalled();
    });

    it("should continue polling when function throws and stopOnError is false", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Test error"))
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const promise = pollFn(fn, {
        timeout: 1000,
        interval: 100,
        stopOnError: false,
      });

      await vi.advanceTimersByTimeAsync(250);
      await promise;

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should stop polling when function throws and stopOnError is true", async () => {
      const error = new Error("Test error");
      const fn = vi.fn().mockRejectedValue(error);

      const promise = pollFn(fn, {
        timeout: 1000,
        interval: 100,
        stopOnError: true,
      });

      // Set up expectation immediately
      const expectation = expect(promise).rejects.toThrow(error);

      await vi.advanceTimersByTimeAsync(50);

      await expectation;
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should use default options when not provided", async () => {
      const fn = vi.fn().mockResolvedValue(false);

      // Start polling with default interval
      pollFn(fn, { timeout: 3000 });

      await vi.advanceTimersByTimeAsync(250);

      // With default interval of 100ms, should be called 3 times by 250ms
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe("TimeoutError", () => {
    it("should have correct name and default message", () => {
      const error = new TimeoutError();
      expect(error.name).toBe("TimeoutError");
      expect(error.message).toBe("Operation timed out");
    });

    it("should accept custom message", () => {
      const error = new TimeoutError("Custom timeout message");
      expect(error.message).toBe("Custom timeout message");
    });
  });

  describe("AbortError", () => {
    it("should have correct name and default message", () => {
      const error = new AbortError();
      expect(error.name).toBe("AbortError");
      expect(error.message).toBe("Operation aborted");
    });

    it("should accept custom message", () => {
      const error = new AbortError("Custom abort message");
      expect(error.message).toBe("Custom abort message");
    });
  });
});
