import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createConsola } from "consola";
import {
  logger,
  createLogger,
  logPerformance,
  logWithContext,
  info,
  warn,
  error,
  debug,
  success,
  fail,
  ready,
  start,
} from "../src/logger";

vi.mock("consola", () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
    fail: vi.fn(),
    ready: vi.fn(),
    start: vi.fn(),
    withTag: vi.fn(),
    level: 3,
  };

  mockLogger.withTag.mockReturnValue(mockLogger);

  return {
    createConsola: vi.fn(() => mockLogger),
    LogLevels: {
      silent: 0,
      error: 1,
      warn: 2,
      info: 3,
      debug: 4,
      trace: 5,
    },
  };
});

describe("logger", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("log level configuration", () => {
    it("should use default info level", async () => {
      delete process.env['DEBUG'];
      delete process.env['LOG_LEVEL'];

      // Re-import to test environment detection
      vi.resetModules();
      await import("../src/logger");

      expect(createConsola).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 3, // info level
        })
      );
    });

    it("should use debug level when DEBUG=1", async () => {
      process.env['DEBUG'] = "1";

      vi.resetModules();
      await import("../src/logger");

      expect(createConsola).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 4, // debug level
        })
      );
    });

    it("should use debug level when DEBUG=true", async () => {
      process.env['DEBUG'] = "true";

      vi.resetModules();
      await import("../src/logger");

      expect(createConsola).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 4, // debug level
        })
      );
    });

    it("should respect LOG_LEVEL environment variable", async () => {
      const testCases = [
        { env: "silent", expected: 0 },
        { env: "fatal", expected: 0 },
        { env: "error", expected: 1 },
        { env: "warn", expected: 2 },
        { env: "log", expected: 3 },
        { env: "info", expected: 3 },
        { env: "debug", expected: 4 },
        { env: "trace", expected: 5 },
        { env: "invalid", expected: 3 }, // default
      ];

      for (const { env, expected } of testCases) {
        process.env['LOG_LEVEL'] = env;
        vi.resetModules();
        await import("../src/logger");

        expect(createConsola).toHaveBeenCalledWith(
          expect.objectContaining({
            level: expected,
          })
        );
      }
    });

    it("should handle uppercase LOG_LEVEL", async () => {
      process.env['LOG_LEVEL'] = "DEBUG";

      vi.resetModules();
      await import("../src/logger");

      expect(createConsola).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 4,
        })
      );
    });
  });

  describe("convenience logging functions", () => {
    it("should bind info function", () => {
      info("Test info message");
      expect(logger.info).toHaveBeenCalledWith("Test info message");
    });

    it("should bind warn function", () => {
      warn("Test warning");
      expect(logger.warn).toHaveBeenCalledWith("Test warning");
    });

    it("should bind error function", () => {
      const err = new Error("Test error");
      error("Error occurred", err);
      expect(logger.error).toHaveBeenCalledWith("Error occurred", err);
    });

    it("should bind debug function", () => {
      debug("Debug info", { data: "test" });
      expect(logger.debug).toHaveBeenCalledWith("Debug info", { data: "test" });
    });

    it("should bind success function", () => {
      success("Operation successful");
      expect(logger.success).toHaveBeenCalledWith("Operation successful");
    });

    it("should bind fail function", () => {
      fail("Operation failed");
      expect(logger.fail).toHaveBeenCalledWith("Operation failed");
    });

    it("should bind ready function", () => {
      ready("Server ready");
      expect(logger.ready).toHaveBeenCalledWith("Server ready");
    });

    it("should bind start function", () => {
      start("Starting process");
      expect(logger.start).toHaveBeenCalledWith("Starting process");
    });
  });

  describe("createLogger", () => {
    it("should create a tagged logger", () => {
      const taggedLogger = createLogger("my-component");

      expect(logger.withTag).toHaveBeenCalledWith("my-component");
      expect(taggedLogger).toBe(logger); // Due to mock returning same instance
    });

    it("should work with different tags", () => {
      createLogger("network");
      createLogger("database");
      createLogger("api");

      expect(logger.withTag).toHaveBeenCalledWith("network");
      expect(logger.withTag).toHaveBeenCalledWith("database");
      expect(logger.withTag).toHaveBeenCalledWith("api");
    });
  });

  describe("logPerformance", () => {
    it("should log performance metrics", () => {
      logPerformance("database.query", 123);

      expect(logger.debug).toHaveBeenCalledWith(
        "[PERF] database.query completed in 123ms",
        undefined
      );
    });

    it("should log performance with additional data", () => {
      const data = { query: "SELECT * FROM users", rows: 100 };
      logPerformance("database.query", 456, data);

      expect(logger.debug).toHaveBeenCalledWith(
        "[PERF] database.query completed in 456ms",
        data
      );
    });

    it("should handle zero duration", () => {
      logPerformance("cache.hit", 0);

      expect(logger.debug).toHaveBeenCalledWith(
        "[PERF] cache.hit completed in 0ms",
        undefined
      );
    });
  });

  describe("logWithContext", () => {
    it("should log info level with context", () => {
      logWithContext("info", "api", "Request received", { method: "GET" });

      expect(logger.withTag).toHaveBeenCalledWith("api");
      expect(logger.info).toHaveBeenCalledWith("Request received", { method: "GET" });
    });

    it("should log warn level with context", () => {
      logWithContext("warn", "auth", "Invalid token format");

      expect(logger.withTag).toHaveBeenCalledWith("auth");
      expect(logger.warn).toHaveBeenCalledWith("Invalid token format", undefined);
    });

    it("should log error level with context", () => {
      const error = new Error("Connection failed");
      logWithContext("error", "database", "Query failed", error);

      expect(logger.withTag).toHaveBeenCalledWith("database");
      expect(logger.error).toHaveBeenCalledWith("Query failed", error);
    });

    it("should log debug level with context", () => {
      logWithContext("debug", "cache", "Cache miss", { key: "user:123" });

      expect(logger.withTag).toHaveBeenCalledWith("cache");
      expect(logger.debug).toHaveBeenCalledWith("Cache miss", { key: "user:123" });
    });

    it("should handle all log levels", () => {
      const levels: Array<"info" | "warn" | "error" | "debug"> = [
        "info",
        "warn",
        "error",
        "debug",
      ];

      levels.forEach((level) => {
        logWithContext(level, "test", `${level} message`);
        expect(logger[level]).toHaveBeenCalledWith(`${level} message`, undefined);
      });
    });
  });

  describe("color utility exports", () => {
    it("should export color utilities", async () => {
      const loggerModule = await import("../src/logger");
      
      // These are re-exported from consola/utils
      expect(loggerModule).toHaveProperty("colors");
      expect(loggerModule).toHaveProperty("getColor");
      expect(loggerModule).toHaveProperty("stripAnsi");
      expect(loggerModule).toHaveProperty("colorize");
    });
  });
});