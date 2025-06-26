import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "./event-emitter";

describe("EventEmitter", () => {
  it("should emit and listen to events", () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();

    emitter.on("test", listener);
    emitter.emit("test", "arg1", "arg2");

    expect(listener).toHaveBeenCalledWith("arg1", "arg2");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should support typed events", () => {
    interface TestEvents {
      data: (value: string) => void;
      error: (error: Error) => void;
      complete: () => void;
    }

    const emitter = new EventEmitter<TestEvents>();
    const dataListener = vi.fn();
    const errorListener = vi.fn();
    const completeListener = vi.fn();

    emitter.on("data", dataListener);
    emitter.on("error", errorListener);
    emitter.on("complete", completeListener);

    emitter.emit("data", "test value");
    emitter.emit("error", new Error("test error"));
    emitter.emit("complete");

    expect(dataListener).toHaveBeenCalledWith("test value");
    expect(errorListener).toHaveBeenCalledWith(expect.any(Error));
    expect(completeListener).toHaveBeenCalledWith();
  });

  it("should handle multiple listeners for the same event", () => {
    const emitter = new EventEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on("test", listener1);
    emitter.on("test", listener2);
    emitter.emit("test", "data");

    expect(listener1).toHaveBeenCalledWith("data");
    expect(listener2).toHaveBeenCalledWith("data");
  });

  it("should support once listeners", () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();

    emitter.once("test", listener);
    emitter.emit("test", "first");
    emitter.emit("test", "second");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("first");
  });

  it("should remove listeners with off", () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();

    emitter.on("test", listener);
    emitter.emit("test", "first");
    emitter.off("test", listener);
    emitter.emit("test", "second");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("first");
  });

  it("should remove all listeners for an event", () => {
    const emitter = new EventEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on("test", listener1);
    emitter.on("test", listener2);
    emitter.removeAllListeners("test");
    emitter.emit("test", "data");

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it("should remove all listeners for all events", () => {
    const emitter = new EventEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on("test1", listener1);
    emitter.on("test2", listener2);
    emitter.removeAllListeners();
    emitter.emit("test1", "data");
    emitter.emit("test2", "data");

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it("should return true when event has listeners", () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();

    emitter.on("test", listener);
    const hasListeners = emitter.emit("test", "data");

    expect(hasListeners).toBe(true);
  });

  it("should return false when event has no listeners", () => {
    const emitter = new EventEmitter();
    const hasListeners = emitter.emit("test", "data");

    expect(hasListeners).toBe(false);
  });

  it("should handle errors in listeners without breaking other listeners", () => {
    const emitter = new EventEmitter();
    const listener1 = vi.fn().mockImplementation(() => {
      throw new Error("Listener error");
    });
    const listener2 = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    emitter.on("test", listener1);
    emitter.on("test", listener2);
    emitter.emit("test", "data");

    expect(listener1).toHaveBeenCalledWith("data");
    expect(listener2).toHaveBeenCalledWith("data");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should return listener count", () => {
    const emitter = new EventEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    expect(emitter.listenerCount("test")).toBe(0);

    emitter.on("test", listener1);
    expect(emitter.listenerCount("test")).toBe(1);

    emitter.on("test", listener2);
    expect(emitter.listenerCount("test")).toBe(2);

    emitter.off("test", listener1);
    expect(emitter.listenerCount("test")).toBe(1);
  });

  it("should return event names", () => {
    const emitter = new EventEmitter();

    emitter.on("event1", () => {});
    emitter.on("event2", () => {});

    const eventNames = emitter.eventNames();
    expect(eventNames).toContain("event1");
    expect(eventNames).toContain("event2");
    expect(eventNames.length).toBe(2);
  });

  it("should return listeners for an event", () => {
    const emitter = new EventEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on("test", listener1);
    emitter.on("test", listener2);

    const listeners = emitter.listeners("test");
    expect(listeners).toContain(listener1);
    expect(listeners).toContain(listener2);
    expect(listeners.length).toBe(2);
  });

  it("should check if event has listeners", () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();

    expect(emitter.hasListeners("test")).toBe(false);

    emitter.on("test", listener);
    expect(emitter.hasListeners("test")).toBe(true);

    emitter.off("test", listener);
    expect(emitter.hasListeners("test")).toBe(false);
  });

  it("should prepend listeners", () => {
    const emitter = new EventEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    let callOrder: number[] = [];

    listener1.mockImplementation(() => callOrder.push(1));
    listener2.mockImplementation(() => callOrder.push(2));

    emitter.on("test", listener1);
    emitter.prependListener("test", listener2);
    emitter.emit("test");

    expect(callOrder).toEqual([2, 1]);
  });

  it("should prepend once listeners", () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();

    emitter.prependOnceListener("test", listener);
    emitter.emit("test", "first");
    emitter.emit("test", "second");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("first");
  });

  it("should handle symbol and number event names", () => {
    const emitter = new EventEmitter();
    const symbolEvent = Symbol("test");
    const numberEvent = 42;
    const symbolListener = vi.fn();
    const numberListener = vi.fn();

    emitter.on(symbolEvent, symbolListener);
    emitter.on(numberEvent, numberListener);

    emitter.emit(symbolEvent, "symbol data");
    emitter.emit(numberEvent, "number data");

    expect(symbolListener).toHaveBeenCalledWith("symbol data");
    expect(numberListener).toHaveBeenCalledWith("number data");
  });

  it("should not affect original listeners array when emitting", () => {
    const emitter = new EventEmitter();
    let listenerCount = 0;

    const listener1 = vi.fn().mockImplementation(() => {
      listenerCount++;
      if (listenerCount === 1) {
        // Add another listener during emission
        emitter.on("test", () => {});
      }
    });

    emitter.on("test", listener1);
    emitter.emit("test");

    // The newly added listener should not be called in this emission
    expect(listener1).toHaveBeenCalledTimes(1);
  });
});