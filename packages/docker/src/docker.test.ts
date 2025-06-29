import { describe, it, expect } from "vitest";
import {
  convertComposeService,
  parseTime,
  validateServiceConfig,
  getServiceColor,
  createServiceTag,
  resetServiceColors,
  DockerErrorHandler,
  DockerErrorType,
  ValidationRules,
} from "./index";

describe("Docker Package", () => {
  describe("Compose Utils", () => {
    it("should parse time strings correctly", () => {
      expect(parseTime("30s")).toBe(30);
      expect(parseTime("2m")).toBe(120);
      expect(parseTime("1h")).toBe(3600);
      expect(parseTime("1m30s")).toBe(90);
    });

    it("should validate service configuration", () => {
      const validConfig = {
        containerName: "test",
        image: "nginx:latest",
      };

      const invalidConfig = {
        containerName: "test",
        // missing image or build
      };

      expect(validateServiceConfig(validConfig)).toEqual([]);
      expect(validateServiceConfig(invalidConfig)).toContain(
        "Service must have either an image or build configuration",
      );
    });

    it("should convert compose service to our format", () => {
      const composeService = {
        image: "nginx:latest",
        ports: ["80:8080"],
        environment: {
          NODE_ENV: "production",
        },
        depends_on: ["db"],
        restart: "unless-stopped",
      };

      const result = convertComposeService("web", composeService);

      expect(result.containerName).toBe("web");
      expect(result.image).toBe("nginx:latest");
      expect(result.restart).toBe("unless-stopped");
      expect(result.ports).toEqual([
        {
          published: 80,
          target: 8080,
          protocol: "tcp",
        },
      ]);
      expect(result.dependsOn).toEqual({
        db: { condition: "service_started" },
      });
    });
  });

  describe("Service Colors", () => {
    it("should assign consistent colors to services", () => {
      resetServiceColors();

      const color1 = getServiceColor("service1");
      const color2 = getServiceColor("service1"); // Same service

      expect(color1).toBe(color2); // Same service gets same color
    });

    it("should create service tags", () => {
      const tag = createServiceTag("test-service");
      expect(tag).toContain("test-service");
      expect(tag).toContain("[");
      expect(tag).toContain("]");
    });
  });

  describe("Error Handler", () => {
    it("should parse Docker errors correctly", () => {
      const mockLogger = {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
      } as any;

      const errorHandler = new DockerErrorHandler(mockLogger);

      const dockerError = {
        statusCode: 404,
        message: "No such image: nonexistent:latest",
      };

      const parsed = errorHandler.parseDockerError(dockerError);

      expect(parsed.type).toBe(DockerErrorType.ImageNotFound);
      expect(parsed.suggestions).toContain("Verify the image name and tag are correct");
    });

    it("should identify port conflicts", () => {
      const mockLogger = {
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
      } as any;

      const errorHandler = new DockerErrorHandler(mockLogger);

      const portError = {
        message: "port is already allocated",
      };

      const parsed = errorHandler.parseDockerError(portError);

      expect(parsed.type).toBe(DockerErrorType.PortInUse);
    });
  });

  describe("Validation Rules", () => {
    it("should validate required fields", () => {
      expect(ValidationRules.required(undefined)).toBe("is required");
      expect(ValidationRules.required("value")).toBe(null);
    });

    it("should validate port numbers", () => {
      expect(ValidationRules.port(8080)).toBe(null);
      expect(ValidationRules.port(0)).toBe("must be a number between 1 and 65535");
      expect(ValidationRules.port(70000)).toBe("must be a number between 1 and 65535");
      expect(ValidationRules.port("invalid")).toBe("must be a number between 1 and 65535");
    });

    it("should validate image names", () => {
      expect(ValidationRules.imageName("nginx:latest")).toBe(null);
      expect(ValidationRules.imageName("nginx")).toBe(null);
      expect(ValidationRules.imageName("registry.com/nginx:v1.0")).toBe(null);
      expect(ValidationRules.imageName("")).toBe("must be a valid Docker image name");
    });

    it("should validate memory sizes", () => {
      expect(ValidationRules.memory("512m")).toBe(null);
      expect(ValidationRules.memory("1g")).toBe(null);
      expect(ValidationRules.memory("1024k")).toBe(null);
      expect(ValidationRules.memory("2048b")).toBe(null);
      expect(ValidationRules.memory("invalid")).toBe("must be a valid memory size (e.g., 512m, 1g)");
      expect(ValidationRules.memory(123)).toBe("must be a string");
    });

    it("should validate duration strings", () => {
      expect(ValidationRules.duration("30s")).toBe(null);
      expect(ValidationRules.duration("1m")).toBe(null);
      expect(ValidationRules.duration("2h")).toBe(null);
      expect(ValidationRules.duration("1d")).toBe(null);
      expect(ValidationRules.duration("invalid")).toBe("must be a valid duration (e.g., 30s, 1m, 2h)");
      expect(ValidationRules.duration(123)).toBe("must be a string");
    });
  });

  describe("Compose Utils - Advanced", () => {
    it("should handle complex compose service conversion", () => {
      const complexService = {
        image: "postgres:15",
        container_name: "my-postgres",
        ports: [{ published: 5432, target: 5432, protocol: "tcp" }, "8080:80"],
        environment: {
          POSTGRES_PASSWORD: "secret",
          POSTGRES_DB: "myapp",
        },
        volumes: [
          "postgres_data:/var/lib/postgresql/data",
          { type: "bind", source: "./config", target: "/config", read_only: true },
        ],
        networks: ["backend", "frontend"],
        healthcheck: {
          test: ["CMD-SHELL", "pg_isready -U postgres"],
          interval: "30s",
          timeout: "10s",
          retries: 3,
          start_period: "40s",
        },
        depends_on: {
          redis: { condition: "service_healthy" },
        },
        deploy: {
          replicas: 2,
          restart_policy: {
            condition: "on-failure",
            max_attempts: 3,
          },
          resources: {
            limits: { cpus: "0.5", memory: "512m" },
            reservations: { memory: "256m" },
          },
        },
        mem_limit: "1g",
        cpu_shares: 512,
        privileged: true,
        cap_add: ["SYS_ADMIN"],
        cap_drop: ["NET_RAW"],
      };

      const result = convertComposeService("postgres", complexService);

      expect(result.containerName).toBe("my-postgres");
      expect(result.image).toBe("postgres:15");
      expect(result.ports).toHaveLength(2);
      expect(result.ports![0]).toEqual({
        published: 5432,
        target: 5432,
        protocol: "tcp",
      });
      expect(result.ports![1]).toEqual({
        published: 8080,
        target: 80,
        protocol: "tcp",
      });
      expect(result.environment).toEqual({
        POSTGRES_PASSWORD: "secret",
        POSTGRES_DB: "myapp",
      });
      expect(result.networks).toEqual(["backend", "frontend"]);
      expect(result.healthCheck?.Test).toEqual(["CMD-SHELL", "pg_isready -U postgres"]);
      expect(result.dependsOn).toEqual({
        redis: { condition: "service_healthy" },
      });
      expect(result.deploy?.replicas).toBe(2);
      expect(result.memLimit).toBe("1g");
      expect(result.privileged).toBe(true);
      expect(result.capAdd).toEqual(["SYS_ADMIN"]);
      expect(result.capDrop).toEqual(["NET_RAW"]);
    });

    it("should parse complex time strings", () => {
      expect(parseTime("1h30m45s")).toBe(5445); // 1*3600 + 30*60 + 45
      expect(parseTime("2h15m")).toBe(8100); // 2*3600 + 15*60
      expect(parseTime("45m30s")).toBe(2730); // 45*60 + 30
      expect(parseTime("1d2h")).toBe(93600); // 1*86400 + 2*3600
      expect(parseTime("123")).toBe(123); // Pass through number strings
    });
  });
});
