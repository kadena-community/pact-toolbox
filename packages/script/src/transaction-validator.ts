import type { PactToolboxClient } from "@pact-toolbox/runtime";
import { logger } from "@pact-toolbox/node-utils";
import { pact } from "@pact-toolbox/kda";

export interface ValidationRule {
  name: string;
  description: string;
  validate: (tx: TransactionData) => ValidationResult;
}

export interface TransactionData {
  pactCode: string;
  meta: {
    gasLimit: number;
    gasPrice: number;
    sender: string;
    chainId: string;
  };
  capabilities?: Array<{
    name: string;
    args: any[];
  }>;
  signers?: string[];
  data?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ValidationConfig {
  /** Maximum gas limit allowed */
  maxGasLimit?: number;
  /** Minimum gas price required */
  minGasPrice?: number;
  /** Required capabilities for certain operations */
  requiredCapabilities?: Record<string, string[]>;
  /** Blocked function calls */
  blockedFunctions?: string[];
  /** Custom validation rules */
  customRules?: ValidationRule[];
  /** Enable strict validation */
  strict?: boolean;
}

export class TransactionValidator {
  private client: PactToolboxClient;
  private config: ValidationConfig;
  private builtInRules: ValidationRule[];

  constructor(client: PactToolboxClient, config: ValidationConfig = {}) {
    this.client = client;
    this.config = {
      maxGasLimit: 1000000,
      minGasPrice: 0.000001,
      requiredCapabilities: {},
      blockedFunctions: [],
      customRules: [],
      strict: false,
      ...config,
    };

    this.builtInRules = this.createBuiltInRules();
  }

  /**
   * Validate a transaction before submission
   */
  async validateTransaction(txData: TransactionData): Promise<ValidationResult> {
    logger.debug(`Validating transaction: ${txData.pactCode.substring(0, 100)}...`);

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Run all validation rules
    const allRules = [...this.builtInRules, ...(this.config.customRules || [])];

    for (const rule of allRules) {
      try {
        const ruleResult = rule.validate(txData);

        result.errors.push(...ruleResult.errors);
        result.warnings.push(...ruleResult.warnings);
        result.suggestions.push(...ruleResult.suggestions);

        if (!ruleResult.valid) {
          result.valid = false;
        }
      } catch (error) {
        logger.warn(`Validation rule ${rule.name} failed: ${error}`);
        result.warnings.push(`Validation rule ${rule.name} encountered an error`);
      }
    }

    // In strict mode, warnings become errors
    if (this.config.strict && result.warnings.length > 0) {
      result.errors.push(...result.warnings);
      result.warnings = [];
      result.valid = false;
    }

    if (!result.valid) {
      logger.warn(`Transaction validation failed: ${result.errors.join(", ")}`);
    } else {
      logger.debug("Transaction validation passed");
    }

    return result;
  }

  /**
   * Validate and simulate a transaction
   */
  async validateAndSimulate(txData: TransactionData): Promise<{
    validation: ValidationResult;
    simulation?: any;
    gasEstimate?: number;
  }> {
    // First validate
    const validation = await this.validateTransaction(txData);

    if (!validation.valid) {
      return { validation };
    }

    try {
      // Simulate the transaction
      const simulation = await this.client
        .execution(txData.pactCode)
        .withChainId(txData.meta.chainId as any)
        .withMeta(txData.meta as any)
        .build()
        .dirtyRead();

      // Estimate gas usage
      const gasEstimate = this.estimateGasFromSimulation(simulation);

      return {
        validation,
        simulation,
        gasEstimate,
      };
    } catch (error) {
      validation.errors.push(`Simulation failed: ${(error as Error).message}`);
      validation.valid = false;
      return { validation };
    }
  }

  /**
   * Create built-in validation rules
   */
  private createBuiltInRules(): ValidationRule[] {
    return [
      {
        name: "gas-limit-check",
        description: "Validate gas limit is within acceptable range",
        validate: (tx) => {
          const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };

          if (tx.meta.gasLimit > (this.config.maxGasLimit || 1000000)) {
            result.valid = false;
            result.errors.push(`Gas limit ${tx.meta.gasLimit} exceeds maximum ${this.config.maxGasLimit}`);
          }

          if (tx.meta.gasLimit < 1000) {
            result.warnings.push("Gas limit is very low, transaction may fail");
          }

          if (tx.meta.gasLimit > 500000) {
            result.warnings.push("Gas limit is very high, consider optimizing");
          }

          return result;
        },
      },

      {
        name: "gas-price-check",
        description: "Validate gas price meets minimum requirements",
        validate: (tx) => {
          const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };

          if (tx.meta.gasPrice < (this.config.minGasPrice || 0.000001)) {
            result.valid = false;
            result.errors.push(`Gas price ${tx.meta.gasPrice} below minimum ${this.config.minGasPrice}`);
          }

          if (tx.meta.gasPrice > 0.01) {
            result.warnings.push("Gas price is very high");
          }

          return result;
        },
      },

      {
        name: "sender-validation",
        description: "Validate sender account format",
        validate: (tx) => {
          const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };

          if (!pact.validateAccountName(tx.meta.sender)) {
            result.valid = false;
            result.errors.push(`Invalid sender account format: ${tx.meta.sender}`);
          }

          return result;
        },
      },

      {
        name: "chain-id-validation",
        description: "Validate chain ID format",
        validate: (tx) => {
          const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };

          const chainId = parseInt(tx.meta.chainId);
          if (isNaN(chainId) || chainId < 0 || chainId > 19) {
            result.valid = false;
            result.errors.push(`Invalid chain ID: ${tx.meta.chainId}`);
          }

          return result;
        },
      },

      {
        name: "pact-code-safety",
        description: "Check for potentially unsafe Pact code patterns",
        validate: (tx) => {
          const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };
          const code = tx.pactCode;

          // Check for dangerous patterns
          if (code.includes("(read-msg)")) {
            result.warnings.push("Direct use of read-msg detected, consider using typed readers");
          }

          if (code.includes("(eval ") || code.includes("(load ")) {
            result.errors.push("Dynamic code evaluation detected, this is unsafe");
            result.valid = false;
          }

          if (code.includes("(enforce false")) {
            result.errors.push("Enforce false detected, this will always fail");
            result.valid = false;
          }

          // Check for blocked functions
          for (const blockedFn of this.config.blockedFunctions || []) {
            if (code.includes(blockedFn)) {
              result.errors.push(`Blocked function detected: ${blockedFn}`);
              result.valid = false;
            }
          }

          return result;
        },
      },

      {
        name: "capability-validation",
        description: "Validate required capabilities are present",
        validate: (tx) => {
          const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };

          // Check for common operations that require capabilities
          if (tx.pactCode.includes("coin.transfer") && tx.capabilities) {
            const hasTransferCap = tx.capabilities.some(
              (cap) => cap.name === "coin.TRANSFER" || cap.name === "coin.GAS",
            );

            if (!hasTransferCap) {
              result.warnings.push("Coin transfer detected but no TRANSFER capability found");
            }
          }

          if (tx.pactCode.includes("coin.create-account") && tx.capabilities) {
            const hasGasCap = tx.capabilities.some((cap) => cap.name === "coin.GAS");

            if (!hasGasCap) {
              result.warnings.push("Account creation detected but no GAS capability found");
            }
          }

          return result;
        },
      },

      {
        name: "signer-consistency",
        description: "Validate signers match capabilities and sender",
        validate: (tx) => {
          const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };

          if (tx.signers && tx.signers.length === 0) {
            result.warnings.push("No signers specified for transaction");
          }

          if (tx.capabilities && tx.capabilities.length > 0 && (!tx.signers || tx.signers.length === 0)) {
            result.warnings.push("Capabilities specified but no signers provided");
          }

          return result;
        },
      },

      {
        name: "data-validation",
        description: "Validate transaction data format",
        validate: (tx) => {
          const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };

          if (tx.data) {
            try {
              JSON.stringify(tx.data);
            } catch {
              result.errors.push("Transaction data is not serializable");
              result.valid = false;
            }

            // Check for large data objects
            const dataSize = JSON.stringify(tx.data).length;
            if (dataSize > 10000) {
              result.warnings.push(`Transaction data is large (${dataSize} bytes)`);
            }
          }

          return result;
        },
      },
    ];
  }

  /**
   * Estimate gas usage from simulation result
   */
  private estimateGasFromSimulation(_simulation: any): number {
    // This is a simplified estimation
    // In a real implementation, you'd analyze the simulation result
    return 50000; // Default estimate
  }

  /**
   * Add a custom validation rule
   */
  addValidationRule(rule: ValidationRule): void {
    this.config.customRules = this.config.customRules || [];
    this.config.customRules.push(rule);
  }

  /**
   * Remove a validation rule by name
   */
  removeValidationRule(name: string): void {
    this.config.customRules = this.config.customRules?.filter((rule) => rule.name !== name) || [];
  }

  /**
   * Get validation configuration
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }

  /**
   * Update validation configuration
   */
  updateConfig(config: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a transaction validator instance
 */
export function createTransactionValidator(client: PactToolboxClient, config?: ValidationConfig): TransactionValidator {
  return new TransactionValidator(client, config);
}

/**
 * Create common validation rules for specific use cases
 */
export const CommonValidationRules = {
  /**
   * Strict deployment validation
   */
  deployment: (): ValidationRule => ({
    name: "deployment-validation",
    description: "Validate contract deployment transactions",
    validate: (tx) => {
      const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };

      if (!tx.pactCode.includes("(module ")) {
        result.errors.push("No module definition found in deployment");
        result.valid = false;
      }

      if (tx.meta.gasLimit < 100000) {
        result.warnings.push("Gas limit may be too low for contract deployment");
      }

      return result;
    },
  }),

  /**
   * Token transfer validation
   */
  tokenTransfer: (minAmount?: number, maxAmount?: number): ValidationRule => ({
    name: "token-transfer-validation",
    description: "Validate token transfer transactions",
    validate: (tx) => {
      const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };

      if (tx.pactCode.includes("transfer")) {
        // Extract amount from transaction (simplified)
        const amountMatch = tx.pactCode.match(/transfer.*?(\d+\.?\d*)/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1]);

          if (minAmount && amount < minAmount) {
            result.errors.push(`Transfer amount ${amount} below minimum ${minAmount}`);
            result.valid = false;
          }

          if (maxAmount && amount > maxAmount) {
            result.errors.push(`Transfer amount ${amount} exceeds maximum ${maxAmount}`);
            result.valid = false;
          }
        }
      }

      return result;
    },
  }),

  /**
   * Namespace operation validation
   */
  namespace: (): ValidationRule => ({
    name: "namespace-validation",
    description: "Validate namespace operations",
    validate: (tx) => {
      const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };

      if (tx.pactCode.includes("define-namespace")) {
        if (!tx.capabilities || !tx.capabilities.some((cap) => cap.name === "ns.ALLOW_NS_DEFINITION")) {
          result.warnings.push("Namespace definition without ALLOW_NS_DEFINITION capability");
        }
      }

      return result;
    },
  }),
};

/**
 * Helper to validate common transaction patterns
 */
export class TransactionPatternValidator {
  private validator: TransactionValidator;

  constructor(validator: TransactionValidator) {
    this.validator = validator;
  }

  /**
   * Validate a coin transfer transaction
   */
  async validateCoinTransfer(from: string, to: string, amount: string, gasLimit?: number): Promise<ValidationResult> {
    const txData: TransactionData = {
      pactCode: `(coin.transfer "${from}" "${to}" ${amount})`,
      meta: {
        gasLimit: gasLimit || 10000,
        gasPrice: 0.00001,
        sender: from,
        chainId: "0",
      },
      capabilities: [
        { name: "coin.TRANSFER", args: [from, to, parseFloat(amount)] },
        { name: "coin.GAS", args: [] },
      ],
      signers: [from.startsWith("k:") ? from.slice(2) : from],
    };

    return this.validator.validateTransaction(txData);
  }

  /**
   * Validate a contract deployment transaction
   */
  async validateContractDeployment(
    contractCode: string,
    gasLimit?: number,
    sender?: string,
  ): Promise<ValidationResult> {
    const txData: TransactionData = {
      pactCode: contractCode,
      meta: {
        gasLimit: gasLimit || 200000,
        gasPrice: 0.00001,
        sender: sender || "sender00",
        chainId: "0",
      },
    };

    return this.validator.validateTransaction(txData);
  }

  /**
   * Validate a namespace creation transaction
   */
  async validateNamespaceCreation(
    namespaceName: string,
    adminKeyset: any,
    gasLimit?: number,
  ): Promise<ValidationResult> {
    const txData: TransactionData = {
      pactCode: `(define-namespace "${namespaceName}" (read-keyset "admin-keyset") (read-keyset "admin-keyset"))`,
      meta: {
        gasLimit: gasLimit || 50000,
        gasPrice: 0.00001,
        sender: "sender00",
        chainId: "0",
      },
      data: {
        "admin-keyset": adminKeyset,
      },
    };

    return this.validator.validateTransaction(txData);
  }
}
