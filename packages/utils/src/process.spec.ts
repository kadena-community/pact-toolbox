import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { ChildProcessWithoutNullStreams } from "child_process";

import { findProcess, isProcessRunning, killProcess, runBin } from "./process";

describe("process", () => {
  describe("runBin", () => {
    it("should run a simple command and resolve", async () => {
      const child = await runBin("echo", ["hello world"], { silent: true });
      assert.ok(child.pid, "Child process should have a PID");
    });

    it("should capture stdout output", async () => {
      const outputs: string[] = [];
      const child = await runBin("echo", ["hello world"], {
        silent: true,
        resolveOnStart: false,
        resolveIf: (data) => {
          outputs.push(data);
          return true;
        },
      });
      assert.ok(child.pid, "Child process should have a PID");
      assert.ok(outputs.includes("hello world\n"), 'Output should include "hello world"');
    });
  });

  describe("findProcess", () => {
    it("should find the current process by PID", async () => {
      const procs = await findProcess({ pid: process.pid });
      assert.ok(procs.length > 0, "Should find at least one process");
      assert.strictEqual(procs[0]?.pid, process.pid, "Found process PID should match current PID");
    });

    it("should return an empty array when process is not found", async () => {
      const procs = await findProcess({ pid: 999999 });
      assert.deepStrictEqual(procs, [], "Should return an empty array");
    });
  });

  describe("isProcessRunning", () => {
    it("should return true for the current process", async () => {
      const running = await isProcessRunning({ pid: process.pid });
      assert.strictEqual(running, true, "Process should be running");
    });

    it("should return false for a non-existent process", async () => {
      const running = await isProcessRunning({ pid: 999999 });
      assert.strictEqual(running, false, "Process should not be running");
    });
  });

  describe("killProcess", () => {
    let childProcess: ChildProcessWithoutNullStreams;

    before(async () => {
      // Start a long-running process (e.g., a simple Node.js timer)
      childProcess = await runBin("node", ["-e", "setInterval(() => {}, 1000);"], { silent: true });
      assert.ok(childProcess.pid, "Child process should have a PID");
    });

    it("should kill the process", async () => {
      const pid = childProcess.pid;
      await killProcess({ pid });

      // Check if the process is still running
      const running = await isProcessRunning({ pid });
      assert.strictEqual(running, false, "Process should have been killed");
    });

    after(async () => {
      // Ensure the process is killed after tests
      if (childProcess && !childProcess.killed) {
        childProcess.kill("SIGKILL");
      }
    });
  });
});
