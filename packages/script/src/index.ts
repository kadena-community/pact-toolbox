// Core exports (now consolidated versions)
export * from "./runner";
export * from "./deployment";
export * from "./script-context";
export * from "./wallet-manager";
export * from "./namespace-handler";
export * from "./transaction-validator";

// Re-export commonly used types and utilities
export type { ScriptContext, ScriptContextBuilder } from "./script-context";

export type { Script, RunScriptOptions, ScriptExecutionResult } from "./runner";

export type { SigningConfig, SignerInfo, WalletManager } from "./wallet-manager";

export type { NamespaceDetectionResult, NamespaceHandlingOptions, NamespaceOperationResult } from "./namespace-handler";

export type { AdvancedDeploymentOptions, AdvancedDeployResult } from "./deployment";

export type { ValidationRule, TransactionData, ValidationResult, ValidationConfig } from "./transaction-validator";

// Helper functions for quick script creation
export { createScript, runScript, listScripts, validateScript, createDefaultScriptOptions } from "./runner";

export { createWalletManager, resolveSigningConfig } from "./wallet-manager";

export { createNamespaceHandler, createDefaultNamespaceOptions } from "./namespace-handler";

export { createDeploymentHelper, createDefaultAdvancedDeploymentOptions } from "./deployment";

export { createTransactionValidator, CommonValidationRules } from "./transaction-validator";
