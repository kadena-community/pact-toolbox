import type {
  NetworkConfig,
  PactServerConfig,
  DevNetContainerConfig,
  DevNetMiningConfig,
} from "./config";
import type { NetworkMeta } from "@pact-toolbox/types";

/**
 * Custom error class for configuration validation errors
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
  ) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

/**
 * Validate a port number
 */
export function validatePort(port: unknown, field: string): number {
  if (typeof port !== "number" || isNaN(port)) {
    throw new ConfigValidationError(`${field} must be a number`, field, port);
  }

  if (port < 1 || port > 65535) {
    throw new ConfigValidationError(`${field} must be between 1 and 65535`, field, port);
  }

  return port;
}

/**
 * Validate a URL string
 */
export function validateUrl(url: unknown, field: string): string {
  if (typeof url !== "string") {
    throw new ConfigValidationError(`${field} must be a string`, field, url);
  }

  // Allow placeholders in URLs - replace with valid values for validation
  const urlWithoutPlaceholders = url
    .replace(/{port}/g, "9091")           // Replace {port} with valid port
    .replace(/{networkId}/g, "testnet")   // Replace {networkId} with valid network ID
    .replace(/{chainId}/g, "0");          // Replace {chainId} with valid chain ID

  try {
    new URL(urlWithoutPlaceholders);
  } catch {
    throw new ConfigValidationError(`${field} has invalid URL format`, field, url);
  }

  return url;
}

/**
 * Validate network ID
 */
export function validateNetworkId(networkId: unknown, field: string): string {
  if (typeof networkId !== "string") {
    throw new ConfigValidationError(`${field} must be a string`, field, networkId);
  }

  if (networkId.length === 0) {
    throw new ConfigValidationError(`${field} cannot be empty`, field, networkId);
  }

  return networkId;
}

/**
 * Validate Pact Server configuration
 */
export function validatePactServerConfig(config: Partial<PactServerConfig>): void {
  if (config.port !== undefined) {
    validatePort(config.port, "serverConfig.port");
  }

  if (config.gasLimit !== undefined) {
    if (typeof config.gasLimit !== "number" || config.gasLimit < 0) {
      throw new ConfigValidationError(
        "Gas limit must be a non-negative number",
        "serverConfig.gasLimit",
        config.gasLimit,
      );
    }
    if (config.gasLimit > 10_000_000) {
      throw new ConfigValidationError("Gas limit exceeds maximum (10M)", "serverConfig.gasLimit", config.gasLimit);
    }
  }

  if (config.gasRate !== undefined) {
    if (typeof config.gasRate !== "number" || config.gasRate < 0) {
      throw new ConfigValidationError("Gas rate must be a non-negative number", "serverConfig.gasRate", config.gasRate);
    }
  }

  if (config.verbose !== undefined && typeof config.verbose !== "boolean") {
    throw new ConfigValidationError("Verbose must be a boolean", "serverConfig.verbose", config.verbose);
  }
}

/**
 * Validate DevNet container configuration
 */
export function validateDevNetContainerConfig(config: Partial<DevNetContainerConfig>): void {
  if (config.port !== undefined) {
    validatePort(config.port, "containerConfig.port");
  }

  if (config.persistDb !== undefined && typeof config.persistDb !== "boolean") {
    throw new ConfigValidationError("PersistDb must be a boolean", "containerConfig.persistDb", config.persistDb);
  }

  if (config.onDemandMining !== undefined && typeof config.onDemandMining !== "boolean") {
    throw new ConfigValidationError(
      "OnDemandMining must be a boolean",
      "containerConfig.onDemandMining",
      config.onDemandMining,
    );
  }

  if (config.constantDelayBlockTime !== undefined) {
    if (typeof config.constantDelayBlockTime !== "number" || config.constantDelayBlockTime < 0) {
      throw new ConfigValidationError(
        "ConstantDelayBlockTime must be a non-negative number",
        "containerConfig.constantDelayBlockTime",
        config.constantDelayBlockTime,
      );
    }
  }
}

/**
 * Validate DevNet mining configuration
 */
export function validateDevNetMiningConfig(config: Partial<DevNetMiningConfig>): void {
  const numericFields = [
    "transactionBatchPeriod",
    "confirmationCount",
    "confirmationPeriod",
    "idlePeriod",
    "miningCooldown",
  ] as const;

  for (const field of numericFields) {
    if (config[field] !== undefined) {
      const value = config[field];
      if (typeof value !== "number" || value < 0) {
        throw new ConfigValidationError(`${field} must be a non-negative number`, `miningConfig.${field}`, value);
      }
    }
  }

  const booleanFields = ["disableConfirmationWorker", "disableIdleWorker"] as const;

  for (const field of booleanFields) {
    if (config[field] !== undefined) {
      const value = config[field];
      if (typeof value !== "boolean") {
        throw new ConfigValidationError(`${field} must be a boolean`, `miningConfig.${field}`, value);
      }
    }
  }
}

/**
 * Validate network metadata
 */
export function validateNetworkMeta(meta: NetworkMeta): void {
  if (meta.chainId && !/^\d+$/.test(meta.chainId)) {
    throw new ConfigValidationError("Chain ID must be a numeric string", "meta.chainId", meta.chainId);
  }

  if (meta.gasLimit !== undefined) {
    if (typeof meta.gasLimit !== "number" || meta.gasLimit < 0) {
      throw new ConfigValidationError("Gas limit must be a non-negative number", "meta.gasLimit", meta.gasLimit);
    }
    if (meta.gasLimit > 10_000_000) {
      throw new ConfigValidationError("Gas limit exceeds maximum (10M)", "meta.gasLimit", meta.gasLimit);
    }
  }

  if (meta.gasPrice !== undefined) {
    if (typeof meta.gasPrice !== "number" || meta.gasPrice < 0) {
      throw new ConfigValidationError("Gas price must be a non-negative number", "meta.gasPrice", meta.gasPrice);
    }
    if (meta.gasPrice > 1) {
      throw new ConfigValidationError("Gas price seems too high (>1 KDA per gas)", "meta.gasPrice", meta.gasPrice);
    }
  }

  if (meta.ttl !== undefined) {
    if (typeof meta.ttl !== "number" || meta.ttl < 0) {
      throw new ConfigValidationError("TTL must be a non-negative number", "meta.ttl", meta.ttl);
    }
    if (meta.ttl > 86400) {
      throw new ConfigValidationError("TTL exceeds maximum (24 hours)", "meta.ttl", meta.ttl);
    }
  }
}

/**
 * Validate network configuration
 */
export function validateNetworkConfig(config: NetworkConfig): void {
  // Validate common fields
  if (!config.networkId) {
    throw new ConfigValidationError("Network ID is required", "networkId");
  }

  validateNetworkId(config.networkId, "networkId");

  if (config.rpcUrl) {
    validateUrl(config.rpcUrl, "rpcUrl");
  }

  if (config.meta) {
    validateNetworkMeta(config.meta);
  }

  // Validate key pairs if present
  if (config.keyPairs) {
    for (let i = 0; i < config.keyPairs.length; i++) {
      const keyPair = config.keyPairs[i];
      if (!keyPair?.publicKey || !/^[a-f0-9]{64}$/.test(keyPair.publicKey)) {
        throw new ConfigValidationError(
          "Public key must be a 64-character hex string",
          `keyPairs[${i}].publicKey`,
          keyPair?.publicKey,
        );
      }
      if (!keyPair?.secretKey || !/^[a-f0-9]{64}$/.test(keyPair.secretKey)) {
        throw new ConfigValidationError(
          "Secret key must be a 64-character hex string",
          `keyPairs[${i}].secretKey`,
          "***", // Don't expose secret keys in errors
        );
      }
    }
  }

  // Validate type-specific fields
  switch (config.type) {
    case "pact-server":
      if (config.serverConfig) {
        validatePactServerConfig(config.serverConfig);
      }
      break;

    case "chainweb-devnet":
      if (config.containerConfig) {
        validateDevNetContainerConfig(config.containerConfig);
      }
      if (config.miningConfig) {
        validateDevNetMiningConfig(config.miningConfig);
      }
      break;

    case "chainweb":
      // Chainweb networks have minimal validation
      break;

    default:
      throw new ConfigValidationError("Invalid network type", "type", (config as any).type);
  }
}
