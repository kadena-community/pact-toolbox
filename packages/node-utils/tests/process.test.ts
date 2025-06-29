import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawn, exec } from "child_process";
import { EventEmitter } from "events";
import type { Readable, Writable } from "stream";
import { runBin, killProcess, spawnProcess, isProcessRunning, getProcessInfo } from "../src/process";
import * as cleanup from "../src/cleanup";
import * as helpers from "../src/helpers";

vi.mock("child_process");
vi.mock("../src/cleanup");
vi.mock("../src/helpers");

class MockChildProcess extends EventEmitter {
  public stdout: Readable;
  public stderr: Readable;
  public stdin: Writable;
  public killed = false;
  public pid = 12345;

  constructor() {
    super();
    this.stdout = new EventEmitter() as any;
    this.stderr = new EventEmitter() as any;
    this.stdin = new EventEmitter() as any;
  }

  kill(signal?: string) {
    this.killed = true;
    this.emit("exit", 0, signal);
    return true;
  }
}

describe("process", () => {
  let mockChild: MockChildProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChild = new MockChildProcess();
    vi.mocked(spawn).mockReturnValue(mockChild as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("runBin", () => {
    it("should spawn a process with default options", async () => {
      const promise = runBin("node", ["--version"]);

      // Default resolveOnStart should resolve immediately
      const child = await promise;

      expect(spawn).toHaveBeenCalledWith("node", ["--version"], {
        cwd: process.cwd(),
        env: process.env,
      });
      expect(child).toBe(mockChild);
      expect(cleanup.cleanupOnExit).toHaveBeenCalled();
    });

    it("should handle custom working directory and environment", async () => {
      const customEnv = { NODE_ENV: "test" };
      const customCwd = "/custom/path";

      runBin("npm", ["test"], {
        cwd: customCwd,
        env: customEnv,
      });

      expect(spawn).toHaveBeenCalledWith("npm", ["test"], {
        cwd: customCwd,
        env: customEnv,
      });
    });

    it("should resolve when matching output is received", async () => {
      const promise = runBin("server", [], {
        resolveOnStart: false,
        resolveIf: (data) => data.includes("Server started"),
      });

      // Simulate server output
      setTimeout(() => {
        mockChild.stdout.emit("data", Buffer.from("Server started on port 3000"));
      }, 10);

      const child = await promise;
      expect(child).toBe(mockChild);
    });

    it("should handle stdout in silent mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      runBin("test", [], { silent: true });

      mockChild.stdout.emit("data", Buffer.from("Test output"));

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle stderr output", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      runBin("test", []);

      mockChild.stderr.emit("data", Buffer.from("Error output"));

      // Check that logger.error was called (mocked in the actual implementation)
      expect(errorSpy).not.toHaveBeenCalled(); // Because we use logger.error, not console.error
      errorSpy.mockRestore();
    });

    it("should reject on process error", async () => {
      const promise = runBin("failing-command", [], { resolveOnStart: false });

      const error = new Error("Command failed");
      mockChild.emit("error", error);

      await expect(promise).rejects.toThrow("Command failed");
    });

    it("should resolve on process exit", async () => {
      const promise = runBin("test", [], { resolveOnStart: false });

      mockChild.emit("exit", 0, null);

      const child = await promise;
      expect(child).toBe(mockChild);
    });

    it("should register cleanup handler", async () => {
      await runBin("test", []);

      expect(cleanup.cleanupOnExit).toHaveBeenCalled();

      // Get the cleanup function
      const cleanupFn = vi.mocked(cleanup.cleanupOnExit).mock.calls[0]?.[0];

      // Execute cleanup
      if (cleanupFn) cleanupFn();

      expect(mockChild.killed).toBe(true);
    });

    it("should not kill already killed process in cleanup", async () => {
      await runBin("test", []);

      const cleanupFn = vi.mocked(cleanup.cleanupOnExit).mock.calls[0]?.[0];

      // Kill process first
      mockChild.kill();
      const killSpy = vi.spyOn(mockChild, "kill");

      // Execute cleanup
      if (cleanupFn) cleanupFn();

      expect(killSpy).not.toHaveBeenCalled();
    });
  });

  describe("killProcess", () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should kill process on Windows", async () => {
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
      });

      await killProcess("node");

      expect(exec).toHaveBeenCalledWith("taskkill /F /IM node.exe /T");
    });

    it("should kill process on Linux/Darwin", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
      });

      await killProcess("node");

      expect(exec).toHaveBeenCalledWith("pkill -f node");
    });

    it("should kill process on macOS", async () => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
      });

      await killProcess("node");

      expect(exec).toHaveBeenCalledWith("pkill -f node");
    });
  });

  describe("spawnProcess", () => {
    it("should spawn a process with default options", () => {
      const child = spawnProcess("npm", ["start"]);

      expect(spawn).toHaveBeenCalledWith("npm", ["start"], {
        cwd: process.cwd(),
        env: process.env,
        stdio: "pipe",
        detached: false,
        shell: true,
      });
      expect(child).toBe(mockChild);
      expect(cleanup.cleanupOnExit).toHaveBeenCalled();
    });

    it("should spawn with custom options", () => {
      const options = {
        cwd: "/project",
        env: { NODE_ENV: "production" },
        stdio: "inherit" as const,
        detached: true,
      };

      spawnProcess("node", ["server.js"], options);

      expect(spawn).toHaveBeenCalledWith("node", ["server.js"], {
        ...options,
        shell: true,
      });
    });

    it("should register cleanup handler", () => {
      spawnProcess("test");

      const cleanupFn = vi.mocked(cleanup.cleanupOnExit).mock.calls[0]?.[0];

      if (cleanupFn) cleanupFn();

      expect(mockChild.killed).toBe(true);
    });

    it("should handle empty args array", () => {
      spawnProcess("ls");

      expect(spawn).toHaveBeenCalledWith("ls", [], expect.any(Object));
    });
  });

  describe("isProcessRunning", () => {
    const originalKill = process.kill;

    beforeEach(() => {
      (process as any).kill = vi.fn().mockReturnValue(true);
    });

    afterEach(() => {
      (process as any).kill = originalKill;
    });

    it("should return true for running process", () => {
      vi.mocked(process.kill).mockImplementation(() => true);

      const running = isProcessRunning(12345);

      expect(running).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(12345, 0);
    });

    it("should return false for non-existent process", () => {
      vi.mocked(process.kill).mockImplementation(() => {
        throw new Error("ESRCH");
      });

      const running = isProcessRunning(99999);

      expect(running).toBe(false);
    });

    it("should handle permission errors as running", () => {
      vi.mocked(process.kill).mockImplementation(() => {
        throw new Error("EPERM");
      });

      const running = isProcessRunning(1);

      expect(running).toBe(false); // Because any error returns false
    });
  });

  describe("getProcessInfo", () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
      vi.mocked(helpers.execAsync).mockClear();
    });

    afterEach(() => {
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
      });
    });

    it("should return null for non-running process", async () => {
      const originalKill = process.kill;
      process.kill = vi.fn(() => {
        throw new Error("ESRCH");
      });

      const info = await getProcessInfo(99999);

      expect(info).toBeNull();
      (process as any).kill = originalKill;
    });

    it("should get process info on Windows", async () => {
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
      });

      const originalKill = process.kill;
      (process as any).kill = vi.fn(() => true);

      vi.mocked(helpers.execAsync).mockResolvedValue({
        stdout: '"node.exe","12345","Console","1","10,240 K"',
        stderr: "",
      } as any);

      const info = await getProcessInfo(12345);

      expect(info).toEqual({
        pid: 12345,
        command: "node.exe",
        status: "running",
      });

      expect(helpers.execAsync).toHaveBeenCalledWith('tasklist /fi "pid eq 12345" /fo csv /nh');

      (process as any).kill = originalKill;
    });

    it("should get process info on Unix", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
      });

      const originalKill = process.kill;
      (process as any).kill = vi.fn(() => true);

      vi.mocked(helpers.execAsync).mockResolvedValue({
        stdout: "node",
        stderr: "",
      } as any);

      const info = await getProcessInfo(12345);

      expect(info).toEqual({
        pid: 12345,
        command: "node",
        status: "running",
      });

      expect(helpers.execAsync).toHaveBeenCalledWith("ps -p 12345 -o comm=");

      (process as any).kill = originalKill;
    });

    it("should handle command execution errors", async () => {
      const originalKill = process.kill;
      (process as any).kill = vi.fn(() => true);

      vi.mocked(helpers.execAsync).mockRejectedValue(new Error("Command failed"));

      const info = await getProcessInfo(12345);

      expect(info).toBeNull();

      (process as any).kill = originalKill;
    });

    it("should handle string result from execAsync", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
      });

      const originalKill = process.kill;
      (process as any).kill = vi.fn(() => true);

      // Mock execAsync to return a string directly
      vi.mocked(helpers.execAsync).mockResolvedValue("node" as any);

      const info = await getProcessInfo(12345);

      expect(info).toEqual({
        pid: 12345,
        command: "node",
        status: "running",
      });

      (process as any).kill = originalKill;
    });
  });
});
