import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRandomNetworkPorts, isPortTaken } from "../src/port";
import * as getPortPlease from "get-port-please";

vi.mock("get-port-please");

describe("port", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRandomNetworkPorts", () => {
    it("should return a set of network ports", async () => {
      // Mock getPort to return sequential ports
      let portCounter = 3000;
      vi.mocked(getPortPlease.getPort).mockImplementation(async () => {
        return portCounter++;
      });

      const ports = await getRandomNetworkPorts();

      expect(ports).toHaveProperty("public");
      expect(ports).toHaveProperty("service");
      expect(ports).toHaveProperty("onDemand");
      expect(ports).toHaveProperty("stratum");
      expect(ports).toHaveProperty("p2p");

      expect(ports.public).toBe(3000);
      expect(ports.service).toBeGreaterThan(ports.public);
      expect(ports.onDemand).toBeGreaterThan(ports.service);
      expect(ports.stratum).toBeGreaterThan(ports.onDemand);
      expect(ports.p2p).toBeGreaterThan(ports.stratum);
    });

    it("should use custom host", async () => {
      let portCounter = 4000;
      vi.mocked(getPortPlease.getPort).mockImplementation(async () => {
        return portCounter++;
      });

      await getRandomNetworkPorts("192.168.1.1");

      expect(getPortPlease.getPort).toHaveBeenCalledWith(
        expect.objectContaining({ host: "192.168.1.1" })
      );
    });

    it("should use custom gaps", async () => {
      let callIndex = 0;
      const mockPorts = [5000, 5050, 5100, 5150, 5200];
      vi.mocked(getPortPlease.getPort).mockImplementation(async () => {
        return mockPorts[callIndex++] as number;
      });

      await getRandomNetworkPorts("127.0.0.1", 50, 100);

      // Check that port ranges were set correctly
      expect(getPortPlease.getPort).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 5050,
          portRange: [5050, 5100],
        })
      );
    });

    it("should throw error for invalid gap values", async () => {
      await expect(getRandomNetworkPorts("127.0.0.1", -1, 100)).rejects.toThrow(
        "Invalid port gap values"
      );

      await expect(getRandomNetworkPorts("127.0.0.1", 0, 100)).rejects.toThrow(
        "Invalid port gap values"
      );

      await expect(getRandomNetworkPorts("127.0.0.1", 100, 50)).rejects.toThrow(
        "Invalid port gap values"
      );

      await expect(getRandomNetworkPorts("127.0.0.1", 10, 70000)).rejects.toThrow(
        "Invalid port gap values"
      );
    });

    it("should throw error if getPort fails", async () => {
      vi.mocked(getPortPlease.getPort).mockRejectedValue(new Error("Port allocation failed"));

      await expect(getRandomNetworkPorts()).rejects.toThrow(
        "Failed to get network ports: Port allocation failed"
      );
    });

    it("should pass correct names to getPort", async () => {
      let portCounter = 6000;
      vi.mocked(getPortPlease.getPort).mockImplementation(async () => {
        return portCounter++;
      });

      await getRandomNetworkPorts();

      const calls = vi.mocked(getPortPlease.getPort).mock.calls;
      expect(calls[0]?.[0]).toMatchObject({ name: "public" });
      expect(calls[1]?.[0]).toMatchObject({ name: "service" });
      expect(calls[2]?.[0]).toMatchObject({ name: "onDemand" });
      expect(calls[3]?.[0]).toMatchObject({ name: "stratum" });
      expect(calls[4]?.[0]).toMatchObject({ name: "p2p" });
    });
  });

  describe("isPortTaken", () => {
    it("should return false when port is available", async () => {
      vi.mocked(getPortPlease.getPort).mockResolvedValue(3000);

      const taken = await isPortTaken(3000);

      expect(taken).toBe(false);
      expect(getPortPlease.getPort).toHaveBeenCalledWith({
        port: 3000,
        host: "127.0.0.1",
      });
    });

    it("should return true when port is taken", async () => {
      vi.mocked(getPortPlease.getPort).mockResolvedValue(3001); // Different port returned

      const taken = await isPortTaken(3000);

      expect(taken).toBe(true);
    });

    it("should handle string port numbers", async () => {
      vi.mocked(getPortPlease.getPort).mockResolvedValue(8080);

      const taken = await isPortTaken("8080");

      expect(taken).toBe(false);
      expect(getPortPlease.getPort).toHaveBeenCalledWith({
        port: 8080,
        host: "127.0.0.1",
      });
    });

    it("should return true on error", async () => {
      vi.mocked(getPortPlease.getPort).mockRejectedValue(new Error("Permission denied"));

      const taken = await isPortTaken(80);

      expect(taken).toBe(true);
    });

    it("should check localhost by default", async () => {
      vi.mocked(getPortPlease.getPort).mockResolvedValue(3000);

      await isPortTaken(3000);

      expect(getPortPlease.getPort).toHaveBeenCalledWith({
        port: 3000,
        host: "127.0.0.1",
      });
    });
  });

  describe("getRandomPort re-export", () => {
    it("should re-export getRandomPort from get-port-please", async () => {
      const { getRandomPort } = await import("../src/port");
      expect(getRandomPort).toBe(getPortPlease.getRandomPort);
    });
  });
});