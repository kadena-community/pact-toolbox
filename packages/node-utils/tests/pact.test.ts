import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAnyPactInstalled, getCurrentPactVersion, installPact, PACT_VERSION_REGEX } from "../src/pact";
import * as helpers from "../src/helpers";

vi.mock("../src/helpers");

describe("pact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PACT_VERSION_REGEX", () => {
    it("should match valid version strings", () => {
      const testCases = [
        { input: "4.11.0", expected: "4.11.0" },
        { input: "4.11", expected: "4.11" },
        { input: "4.11.0-dev", expected: "4.11.0-dev" },
        { input: "4.11-nightly", expected: "4.11-nightly" },
        { input: "pact version 4.11.0", expected: "4.11.0" },
        { input: "10.0.1-alpha", expected: "10.0.1-alpha" },
      ];

      testCases.forEach(({ input, expected }) => {
        const match = input.match(PACT_VERSION_REGEX);
        expect(match?.[0]).toBe(expected);
      });
    });

    it("should not match invalid version strings", () => {
      const testCases = ["invalid", "4.", "", "abc.def"];

      testCases.forEach((input) => {
        const match = input.match(PACT_VERSION_REGEX);
        expect(match).toBeNull();
      });
    });
  });

  describe("getCurrentPactVersion", () => {
    it("should return version when pact is installed", async () => {
      vi.mocked(helpers.execAsync).mockResolvedValue({
        stdout: "pact version 4.11.0",
        stderr: "",
      } as any);

      const version = await getCurrentPactVersion();

      expect(version).toBe("4.11.0");
      expect(helpers.execAsync).toHaveBeenCalledWith("pact --version");
    });

    it("should return undefined when pact is not installed", async () => {
      vi.mocked(helpers.execAsync).mockRejectedValue(new Error("Command not found"));

      const version = await getCurrentPactVersion();

      expect(version).toBeUndefined();
    });

    it("should return undefined when version format is invalid", async () => {
      vi.mocked(helpers.execAsync).mockResolvedValue({
        stdout: "invalid version output",
        stderr: "",
      } as any);

      const version = await getCurrentPactVersion();

      expect(version).toBeUndefined();
    });

    it("should handle different version formats", async () => {
      const testCases = [
        { output: "4.11", expected: "4.11" },
        { output: "Pact 4.11.0-dev", expected: "4.11.0-dev" },
        { output: "pact version: 5.0.0", expected: "5.0.0" },
      ];

      for (const { output, expected } of testCases) {
        vi.mocked(helpers.execAsync).mockResolvedValue({
          stdout: output,
          stderr: "",
        } as any);

        const version = await getCurrentPactVersion();
        expect(version).toBe(expected);
      }
    });
  });

  describe("isAnyPactInstalled", () => {
    it("should return true when pact is installed", async () => {
      vi.mocked(helpers.execAsync).mockResolvedValue({
        stdout: "pact version 4.11.0",
        stderr: "",
      } as any);

      const installed = await isAnyPactInstalled();

      expect(installed).toBe(true);
    });

    it("should return false when pact is not installed", async () => {
      vi.mocked(helpers.execAsync).mockRejectedValue(new Error("Command not found"));

      const installed = await isAnyPactInstalled();

      expect(installed).toBe(false);
    });

    it("should check for specific version match", async () => {
      vi.mocked(helpers.execAsync).mockResolvedValue({
        stdout: "pact version 4.11.0",
        stderr: "",
      } as any);

      expect(await isAnyPactInstalled("4.11")).toBe(true);
      expect(await isAnyPactInstalled("4.12")).toBe(false);
      expect(await isAnyPactInstalled("4.11.0")).toBe(true);
    });

    it("should return false when no version found but match requested", async () => {
      vi.mocked(helpers.execAsync).mockRejectedValue(new Error("Command not found"));

      const installed = await isAnyPactInstalled("4.11");

      expect(installed).toBe(false);
    });
  });

  describe("installPact", () => {
    it("should install latest version by default", async () => {
      const mockResult = { stdout: "Installation complete", stderr: "" };
      vi.mocked(helpers.execAsync).mockResolvedValue(mockResult as any);

      const result = await installPact();

      expect(result).toBe(mockResult);
      expect(helpers.execAsync).toHaveBeenCalledWith("npx pactup install --latest");
    });

    it("should install specific version when provided", async () => {
      const mockResult = { stdout: "Installation complete", stderr: "" };
      vi.mocked(helpers.execAsync).mockResolvedValue(mockResult as any);

      const result = await installPact("4.11.0");

      expect(result).toBe(mockResult);
      expect(helpers.execAsync).toHaveBeenCalledWith("npx pactup install 4.11.0");
    });

    it("should install nightly version when specified", async () => {
      const mockResult = { stdout: "Installation complete", stderr: "" };
      vi.mocked(helpers.execAsync).mockResolvedValue(mockResult as any);

      const result = await installPact(undefined, true);

      expect(result).toBe(mockResult);
      expect(helpers.execAsync).toHaveBeenCalledWith("npx pactup install --nightly");
    });

    it("should prioritize nightly over version", async () => {
      const mockResult = { stdout: "Installation complete", stderr: "" };
      vi.mocked(helpers.execAsync).mockResolvedValue(mockResult as any);

      const result = await installPact("4.11.0", true);

      expect(result).toBe(mockResult);
      expect(helpers.execAsync).toHaveBeenCalledWith("npx pactup install --nightly");
    });

    it("should propagate installation errors", async () => {
      const error = new Error("Installation failed");
      vi.mocked(helpers.execAsync).mockRejectedValue(error);

      await expect(installPact()).rejects.toThrow("Installation failed");
    });
  });
});
