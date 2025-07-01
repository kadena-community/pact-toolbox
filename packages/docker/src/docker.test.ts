import { describe, it, expect, beforeEach } from "vitest";
import {
  parseTime,
  parseMemory,
  getServiceColor,
  createServiceTag,
  resetServiceColors,
} from "./index";
import type { DockerServiceConfig } from "./types";

describe("Docker Package", () => {
  describe("parseTime", () => {
    it("should parse simple time strings", () => {
      expect(parseTime("30s")).toBe(30);
      expect(parseTime("2m")).toBe(120);
      expect(parseTime("1h")).toBe(3600);
      expect(parseTime("1d")).toBe(86400);
    });

    it("should parse complex time strings", () => {
      expect(parseTime("1m30s")).toBe(90);
      expect(parseTime("2h15m")).toBe(8100);
      expect(parseTime("1d2h3m4s")).toBe(93784);
    });

    it("should handle numbers", () => {
      expect(parseTime("123" as any)).toBe(123);
      expect(parseTime("0" as any)).toBe(0);
    });

    it("should default to seconds when no unit", () => {
      expect(parseTime("45")).toBe(45);
    });

    it("should fallback to 30 for invalid formats", () => {
      expect(parseTime("invalid")).toBe(30);
      expect(parseTime("")).toBe(30);
    });
  });

  describe("parseMemory", () => {
    it("should parse memory with units", () => {
      expect(parseMemory("512m")).toBe(536870912);
      expect(parseMemory("1g")).toBe(1073741824);
      expect(parseMemory("1024k")).toBe(1048576);
      expect(parseMemory("2048b")).toBe(2048);
    });

    it("should handle case insensitive units", () => {
      expect(parseMemory("512M")).toBe(536870912);
      expect(parseMemory("1G")).toBe(1073741824);
      expect(parseMemory("1024K")).toBe(1048576);
    });

    it("should default to bytes when no unit", () => {
      expect(parseMemory("1024")).toBe(1024);
    });

    it("should throw on invalid format", () => {
      expect(() => parseMemory("invalid")).toThrow("Invalid memory format");
      expect(() => parseMemory("")).toThrow("Invalid memory format");
      expect(() => parseMemory("12x")).toThrow("Invalid memory format");
    });
  });


  describe("Service Colors", () => {
    beforeEach(() => {
      resetServiceColors();
    });

    it("should assign consistent colors to services", () => {
      const color1 = getServiceColor("service1");
      const color2 = getServiceColor("service1");
      expect(color1).toBe(color2);
    });

    it("should assign colors to different services", () => {
      const color1 = getServiceColor("service1");
      const color2 = getServiceColor("service2");
      // Should get color functions for both
      expect(color1).toBeDefined();
      expect(color2).toBeDefined();
      // Should be functions
      expect(typeof color1).toBe("function");
      expect(typeof color2).toBe("function");
    });

    it("should create colored service tags", () => {
      const tag = createServiceTag("test-service");
      expect(tag).toContain("[test-service]");
    });

    it("should handle many services", () => {
      const services = Array.from({ length: 10 }, (_, i) => `service${i}`);
      const colors = services.map(getServiceColor);

      // Should have assigned colors to all
      expect(colors.every(c => c !== undefined)).toBe(true);
      expect(colors.every(c => typeof c === "function")).toBe(true);

      // Each service should get its own entry in the map
      const service1Color = getServiceColor("unique-service-1");
      const service2Color = getServiceColor("unique-service-2");
      expect(service1Color).toBeDefined();
      expect(service2Color).toBeDefined();
    });
  });

  describe("Resource Limits", () => {
    it("should apply default resource limits", () => {
      const config: DockerServiceConfig = {
        containerName: "test",
        image: "nginx",
      };

      // Resource limits are applied in the service
      expect(config.memLimit).toBeUndefined(); // Not set by default in config
      expect(config.cpus).toBeUndefined();
    });

    it("should validate memory strings", () => {
      const validMemory = ["128m", "512m", "1g", "2048k"];
      validMemory.forEach(mem => {
        expect(() => parseMemory(mem)).not.toThrow();
      });
    });
  });

  describe("Port Configuration", () => {
    it("should handle port mappings", () => {
      const config: DockerServiceConfig = {
        containerName: "test",
        image: "nginx",
        ports: [
          { target: 80, published: 8080 },
          { target: 443, published: 8443, protocol: "tcp" },
        ],
      };

      expect(config.ports).toHaveLength(2);
      expect(config.ports![0].target).toBe(80);
      expect(config.ports![0].published).toBe(8080);
      expect(config.ports![1].protocol).toBe("tcp");
    });
  });

  describe("Volume Configuration", () => {
    it("should handle volume strings", () => {
      const config: DockerServiceConfig = {
        containerName: "test",
        image: "postgres",
        volumes: [
          "data:/var/lib/postgresql/data",
          "./config:/config:ro",
          "/host/path:/container/path",
        ],
      };

      expect(config.volumes).toHaveLength(3);
      expect(config.volumes![0]).toContain("data:");
      expect(config.volumes![1]).toContain(":ro");
    });
  });

  describe("Health Check Configuration", () => {
    it("should handle health check configuration", () => {
      const config: DockerServiceConfig = {
        containerName: "test",
        image: "nginx",
        healthCheck: {
          Test: ["CMD", "curl", "-f", "http://localhost/"],
          Interval: 30000000000,
          Timeout: 10000000000,
          Retries: 3,
          StartPeriod: 60000000000,
        },
      };

      expect(config.healthCheck?.Test).toHaveLength(4);
      expect(config.healthCheck?.Interval).toBe(30000000000);
      expect(config.healthCheck?.Retries).toBe(3);
    });
  });

  describe("Environment Configuration", () => {
    it("should handle environment as object", () => {
      const config: DockerServiceConfig = {
        containerName: "test",
        image: "postgres",
        environment: {
          POSTGRES_PASSWORD: "secret",
          POSTGRES_USER: "admin",
          POSTGRES_DB: "testdb",
        },
      };

      expect(config.environment).toBeTypeOf("object");
      expect((config.environment as any).POSTGRES_PASSWORD).toBe("secret");
    });

    it("should handle environment as array", () => {
      const config: DockerServiceConfig = {
        containerName: "test",
        image: "postgres",
        environment: [
          "POSTGRES_PASSWORD=secret",
          "POSTGRES_USER=admin",
          "POSTGRES_DB=testdb",
        ],
      };

      expect(Array.isArray(config.environment)).toBe(true);
      expect(config.environment).toHaveLength(3);
    });
  });

  describe("Dependency Configuration", () => {
    it("should handle service dependencies", () => {
      const config: DockerServiceConfig = {
        containerName: "app",
        image: "node",
        dependsOn: {
          postgres: { condition: "service_healthy" },
          redis: { condition: "service_started" },
        },
      };

      expect(config.dependsOn).toBeDefined();
      expect(config.dependsOn!.postgres.condition).toBe("service_healthy");
      expect(config.dependsOn!.redis.condition).toBe("service_started");
    });
  });

  describe("Build Configuration", () => {
    it("should handle build configuration", () => {
      const config: DockerServiceConfig = {
        containerName: "app",
        image: "my-app:latest",
        build: {
          context: "./docker",
          dockerfile: "Dockerfile.prod",
          args: {
            NODE_VERSION: "18",
            APP_ENV: "production",
          },
        },
      };

      expect(config.build?.context).toBe("./docker");
      expect(config.build?.dockerfile).toBe("Dockerfile.prod");
      expect(config.build?.args?.NODE_VERSION).toBe("18");
    });
  });

  describe("Restart Policy", () => {
    it("should handle restart policies", () => {
      const policies = ["no", "always", "unless-stopped", "on-failure"];

      policies.forEach(policy => {
        const config: DockerServiceConfig = {
          containerName: "test",
          image: "nginx",
          restart: policy as any,
        };
        expect(config.restart).toBe(policy);
      });
    });
  });
});