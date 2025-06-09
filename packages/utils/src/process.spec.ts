import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runBin } from "./process";

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
});
