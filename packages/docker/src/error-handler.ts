/**
 * Enhanced error handling and logging for Docker operations
 */
import type { Logger } from "@pact-toolbox/node-utils";

export enum DockerErrorType {
  ImageNotFound = "IMAGE_NOT_FOUND",
  ContainerNotFound = "CONTAINER_NOT_FOUND",
  NetworkNotFound = "NETWORK_NOT_FOUND",
  VolumeNotFound = "VOLUME_NOT_FOUND",
  PortInUse = "PORT_IN_USE",
  InsufficientResources = "INSUFFICIENT_RESOURCES",
  BuildFailed = "BUILD_FAILED",
  HealthCheckFailed = "HEALTH_CHECK_FAILED",
  DependencyFailed = "DEPENDENCY_FAILED",
  PermissionDenied = "PERMISSION_DENIED",
  NetworkConflict = "NETWORK_CONFLICT",
  VolumeInUse = "VOLUME_IN_USE",
  InvalidConfiguration = "INVALID_CONFIGURATION",
  Timeout = "TIMEOUT",
  Unknown = "UNKNOWN",
}

export interface DockerError extends Error {
  type: DockerErrorType;
  code?: string | number;
  context?: any;
  serviceName?: string;
  containerName?: string;
  suggestions?: string[];
}

export class DockerErrorHandler {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Parse Docker API error and convert to our enhanced error format
   */
  parseDockerError(error: any, context?: { serviceName?: string; containerName?: string }): DockerError {
    const dockerError: DockerError = {
      name: "DockerError",
      message: error.message || "Unknown Docker error",
      type: DockerErrorType.Unknown,
      code: error.statusCode || error.code,
      context: error,
      serviceName: context?.serviceName,
      containerName: context?.containerName,
      suggestions: [],
    };

    // Parse based on status code
    if (error.statusCode) {
      switch (error.statusCode) {
        case 404:
          dockerError.type = this.determineNotFoundType(error.message);
          dockerError.suggestions = this.getNotFoundSuggestions(dockerError.type);
          break;
        case 409:
          dockerError.type = this.determineConflictType(error.message);
          dockerError.suggestions = this.getConflictSuggestions(dockerError.type);
          break;
        case 500:
          dockerError.type = DockerErrorType.InsufficientResources;
          dockerError.suggestions = [
            "Check system resources (memory, disk space)",
            "Verify Docker daemon is running properly",
            "Check for resource limits or quotas",
          ];
          break;
        case 403:
          dockerError.type = DockerErrorType.PermissionDenied;
          dockerError.suggestions = [
            "Check Docker daemon permissions",
            "Verify user is in docker group",
            "Check if running with sufficient privileges",
          ];
          break;
      }
    }

    // Parse based on error message content
    if (error.message) {
      const message = error.message.toLowerCase();

      if (message.includes("port is already allocated") || message.includes("bind: address already in use")) {
        dockerError.type = DockerErrorType.PortInUse;
        dockerError.suggestions = [
          "Change the host port to an available port",
          "Stop the service using the conflicting port",
          "Use dynamic port allocation",
        ];
      } else if (message.includes("pull access denied") || message.includes("repository does not exist")) {
        dockerError.type = DockerErrorType.ImageNotFound;
        dockerError.suggestions = [
          "Check if the image name and tag are correct",
          "Verify you have access to the registry",
          "Try pulling the image manually first",
        ];
      } else if (message.includes("dockerfile") || message.includes("build")) {
        dockerError.type = DockerErrorType.BuildFailed;
        dockerError.suggestions = [
          "Check Dockerfile syntax",
          "Verify build context and dependencies",
          "Review build logs for specific errors",
        ];
      } else if (message.includes("health check") || message.includes("unhealthy")) {
        dockerError.type = DockerErrorType.HealthCheckFailed;
        dockerError.suggestions = [
          "Review health check configuration",
          "Check service logs for startup issues",
          "Verify health check command is correct",
        ];
      } else if (message.includes("timeout") || message.includes("timed out")) {
        dockerError.type = DockerErrorType.Timeout;
        dockerError.suggestions = [
          "Increase timeout values",
          "Check service startup time",
          "Verify dependencies are available",
        ];
      }
    }

    return dockerError;
  }

  private determineNotFoundType(message: string): DockerErrorType {
    const msg = message.toLowerCase();
    if (msg.includes("image") || msg.includes("repository")) {
      return DockerErrorType.ImageNotFound;
    } else if (msg.includes("container")) {
      return DockerErrorType.ContainerNotFound;
    } else if (msg.includes("network")) {
      return DockerErrorType.NetworkNotFound;
    } else if (msg.includes("volume")) {
      return DockerErrorType.VolumeNotFound;
    }
    return DockerErrorType.Unknown;
  }

  private determineConflictType(message: string): DockerErrorType {
    const msg = message.toLowerCase();
    if (msg.includes("network")) {
      return DockerErrorType.NetworkConflict;
    } else if (msg.includes("volume") && msg.includes("in use")) {
      return DockerErrorType.VolumeInUse;
    } else if (msg.includes("port") || msg.includes("address already in use")) {
      return DockerErrorType.PortInUse;
    }
    return DockerErrorType.Unknown;
  }

  private getNotFoundSuggestions(type: DockerErrorType): string[] {
    switch (type) {
      case DockerErrorType.ImageNotFound:
        return [
          "Verify the image name and tag are correct",
          "Check if you have access to the registry",
          "Try building the image if using a build configuration",
        ];
      case DockerErrorType.ContainerNotFound:
        return [
          "Check if the container was created successfully",
          "Verify the container name is correct",
          "Check if the container was removed",
        ];
      case DockerErrorType.NetworkNotFound:
        return [
          "Verify the network name is correct",
          "Check if the network was created",
          "Use the default bridge network if appropriate",
        ];
      case DockerErrorType.VolumeNotFound:
        return [
          "Verify the volume name is correct",
          "Check if the volume was created",
          "Use bind mounts instead of named volumes",
        ];
      default:
        return ["Check the resource name and configuration"];
    }
  }

  private getConflictSuggestions(type: DockerErrorType): string[] {
    switch (type) {
      case DockerErrorType.PortInUse:
        return [
          "Change to a different host port",
          "Stop the service using the conflicting port",
          "Use port 0 for dynamic allocation",
        ];
      case DockerErrorType.NetworkConflict:
        return [
          "Use a different network name",
          "Remove the existing network if safe",
          "Check network configuration for conflicts",
        ];
      case DockerErrorType.VolumeInUse:
        return [
          "Stop containers using the volume",
          "Use a different volume name",
          "Force remove if data loss is acceptable",
        ];
      default:
        return ["Resolve the resource conflict"];
    }
  }

  /**
   * Log error with context and suggestions
   */
  logError(error: DockerError, operation: string): void {
    const prefix = error.serviceName ? `[${error.serviceName}]` : "";

    this.logger.error(`${prefix} ${operation} failed:`, error.message);

    if (error.code) {
      this.logger.error(`${prefix} Error code: ${error.code}`);
    }

    if (error.suggestions && error.suggestions.length > 0) {
      this.logger.info(`${prefix} Suggestions:`);
      error.suggestions.forEach((suggestion, index) => {
        this.logger.info(`${prefix}   ${index + 1}. ${suggestion}`);
      });
    }

    if (error.context) {
      this.logger.debug(`${prefix} Full error context:`, error.context);
    }
  }

  /**
   * Handle and log error with automatic parsing
   */
  handleError(error: any, operation: string, context?: { serviceName?: string; containerName?: string }): DockerError {
    const dockerError = this.parseDockerError(error, context);
    this.logError(dockerError, operation);
    return dockerError;
  }

  /**
   * Wrap async operation with error handling
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: { serviceName?: string; containerName?: string },
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.handleError(error, operationName, context);
    }
  }

  /**
   * Create a retry wrapper for operations that might fail temporarily
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: {
      maxRetries?: number;
      delay?: number;
      backoff?: boolean;
      retryableTypes?: DockerErrorType[];
      context?: { serviceName?: string; containerName?: string };
    } = {},
  ): Promise<T> {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = true,
      retryableTypes = [DockerErrorType.InsufficientResources, DockerErrorType.Timeout],
      context,
    } = options;

    let lastError: DockerError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.parseDockerError(error, context);

        if (attempt > maxRetries) {
          this.logError(lastError, `${operationName} (final attempt)`);
          throw lastError;
        }

        if (!retryableTypes.includes(lastError.type)) {
          this.logError(lastError, operationName);
          throw lastError;
        }

        const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
        this.logger.warn(
          `${context?.serviceName ? `[${context.serviceName}]` : ""} ${operationName} failed (attempt ${attempt}/${maxRetries + 1}), retrying in ${waitTime}ms...`,
        );

        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    throw lastError!;
  }

  /**
   * Validate configuration and return issues
   */
  validateConfiguration(config: any, rules: { [field: string]: (value: any) => string | null }): string[] {
    const issues: string[] = [];

    for (const [field, validator] of Object.entries(rules)) {
      const value = config[field];
      const issue = validator(value);
      if (issue) {
        issues.push(`${field}: ${issue}`);
      }
    }

    return issues;
  }
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  required: (value: any) => (value === undefined || value === null ? "is required" : null),

  nonEmpty: (value: any) => (!value || (typeof value === "string" && value.trim() === "") ? "cannot be empty" : null),

  port: (value: any) => {
    if (typeof value !== "number" || value < 1 || value > 65535) {
      return "must be a number between 1 and 65535";
    }
    return null;
  },

  path: (value: any) => {
    if (typeof value !== "string") return "must be a string";
    if (!value.startsWith("/") && !value.startsWith("./") && !value.startsWith("../")) {
      return "must be an absolute or relative path";
    }
    return null;
  },

  imageName: (value: any) => {
    if (typeof value !== "string") return "must be a string";
    if (!/^[a-z0-9._/-]+(?::[a-z0-9._-]+)?$/i.test(value)) {
      return "must be a valid Docker image name";
    }
    return null;
  },

  memory: (value: any) => {
    if (typeof value !== "string") return "must be a string";
    if (!/^\d+[bkmg]?$/i.test(value)) {
      return "must be a valid memory size (e.g., 512m, 1g)";
    }
    return null;
  },

  duration: (value: any) => {
    if (typeof value !== "string") return "must be a string";
    if (!/^\d+[smhd]?$/.test(value)) {
      return "must be a valid duration (e.g., 30s, 1m, 2h)";
    }
    return null;
  },
};
