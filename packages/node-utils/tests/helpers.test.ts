import { describe, it, expect } from "vitest";
import { execAsync } from "../src/helpers";

describe("helpers", () => {
  describe("execAsync", () => {
    it("should execute a command and return stdout", async () => {
      const result = await execAsync("echo 'Hello World'");

      expect(result.stdout.toString().trim()).toBe("Hello World");
      expect(result.stderr.toString()).toBe("");
    });

    it("should handle commands with arguments", async () => {
      const result = await execAsync("node --version");

      expect(result.stdout.toString()).toMatch(/^v\d+\.\d+\.\d+/);
    });

    it("should capture stderr output", async () => {
      // Use a command that writes to stderr
      const result = await execAsync("node -e \"console.error('Error message')\"");

      expect(result.stderr.toString().trim()).toBe("Error message");
    });

    it("should throw on non-zero exit code", async () => {
      await expect(execAsync('node -e "process.exit(1)"')).rejects.toThrow();
    });

    it("should throw on invalid command", async () => {
      await expect(execAsync("this-command-does-not-exist")).rejects.toThrow();
    });

    it("should handle commands with quotes", async () => {
      const result = await execAsync(`echo "Hello 'World'"`);

      expect(result.stdout.toString().trim()).toBe("Hello 'World'");
    });

    it("should handle multiline output", async () => {
      const result = await execAsync("node -e \"console.log('Line 1\\nLine 2\\nLine 3')\"");

      const lines = result.stdout.toString().trim().split("\n");
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe("Line 1");
      expect(lines[1]).toBe("Line 2");
      expect(lines[2]).toBe("Line 3");
    });

    it("should preserve environment variables", async () => {
      process.env["TEST_VAR"] = "test-value";
      const result = await execAsync('node -e "console.log(process.env.TEST_VAR)"');

      expect(result.stdout.toString().trim()).toBe("test-value");
      delete process.env["TEST_VAR"];
    });

    it("should handle unicode output", async () => {
      const result = await execAsync("node -e \"console.log('Hello 世界 🌍')\"");

      expect(result.stdout.toString().trim()).toBe("Hello 世界 🌍");
    });

    it("should handle empty output", async () => {
      const result = await execAsync('node -e ""');

      expect(result.stdout.toString()).toBe("");
      expect(result.stderr.toString()).toBe("");
    });
  });
});
