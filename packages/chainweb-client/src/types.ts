// Re-export for convenience
export type { SignedTransaction } from "@pact-toolbox/types";

/**
 * Network configuration for ChainwebClient
 */
export interface NetworkConfig {
  /** Network ID (e.g., 'mainnet01', 'testnet04', 'development') */
  networkId: string;
  /** Chain ID (e.g., '0', '1', '2', etc.) */
  chainId: string;
  /** Chainweb API endpoint or Pact API endpoint */
  rpcUrl: (networkId: string, chainId: string) => string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom headers to include in requests */
  headers?: Record<string, string>;
}

/**
 * Transaction send result
 */
export interface SendResult {
  /** Request keys for tracking */
  requestKeys: string[];
  /** Raw response from server */
  response: any;
}

/**
 * Transaction listen result
 */
export interface ListenResult {
  /** Request key */
  requestKey: string;
  /** Transaction result */
  result: TransactionResult;
  /** Transaction metadata */
  metadata?: any;
}

/**
 * Transaction result from chainweb
 */
export interface TransactionResult {
  /** Request key */
  reqKey: string;
  /** Transaction logs */
  logs: string;
  /** Transaction events */
  events: any[];
  /** Gas used */
  gas: number;
  /** Transaction result data */
  result: {
    status: "success" | "failure";
    data?: any;
    error?: {
      message: string;
      info?: any;
    };
  };
  /** Transaction metadata */
  metaData?: {
    blockTime: number;
    blockHeight: number;
    blockHash: string;
    prevBlockHash: string;
  };
  /** Continuation information */
  continuation?: any;
  /** Transaction ID */
  txId?: number;
}

/**
 * Local query result
 */
export interface LocalResult {
  /** Query result */
  result: {
    status: "success" | "failure";
    data?: any;
    error?: {
      message: string;
      info?: any;
    };
  };
  /** Gas used */
  gas: number;
  /** Query logs */
  logs: string;
  /** Query events */
  events: any[];
  /** Continuation information */
  continuation?: any;
}

/**
 * Poll request for transaction status
 */
export interface PollRequest {
  /** Request keys to poll */
  requestKeys: string[];
}

/**
 * Poll response from chainweb
 */
export interface PollResponse {
  [requestKey: string]: TransactionResult;
}

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  /** Successful results */
  successes: T[];
  /** Failed operations with errors */
  failures: Array<{
    error: ChainwebClientError;
    index: number;
  }>;
  /** Total operations attempted */
  total: number;
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  failureCount: number;
}

/**
 * Network information
 */
export interface NetworkInfo {
  /** Network ID */
  networkId: string;
  /** Chainweb version */
  chainwebVersion: string;
  /** Number of chains */
  chainCount: number;
  /** Available chains */
  chains: string[];
  /** Network start time */
  startTime?: number;
}

/**
 * Chain information
 */
export interface ChainInfo {
  /** Chain ID */
  chainId: string;
  /** Current block height */
  height: number;
  /** Current block hash */
  hash: string;
  /** Parent block hash */
  parent: string;
  /** Block creation time */
  creationTime: number;
  /** Block weight */
  weight: string;
}

/**
 * Cut information (all chains)
 */
export interface CutInfo {
  /** Cut height */
  height: number;
  /** Cut weight */
  weight: string;
  /** Cut hash */
  hash: string;
  /** Per-chain information */
  chains: Record<string, ChainInfo>;
}

/**
 * Health check result
 */
export interface HealthCheck {
  /** Service is healthy */
  healthy: boolean;
  /** Check timestamp */
  timestamp: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Additional details */
  details?: Record<string, any>;
}

/**
 * Request configuration
 */
export interface RequestConfig {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Abort signal */
  signal?: AbortSignal;
}


/**
 * ChainwebClient error
 */
export class ChainwebClientError extends Error {
  constructor(
    message: string,
    public readonly code: ChainwebErrorCode,
    public readonly status?: number,
    public readonly response?: any,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ChainwebClientError";
  }

  /**
   * Create network error
   */
  static network(message: string, cause?: unknown): ChainwebClientError {
    return new ChainwebClientError(message, "NETWORK_ERROR", undefined, undefined, cause);
  }

  /**
   * Create timeout error
   */
  static timeout(timeout: number): ChainwebClientError {
    return new ChainwebClientError(`Request timed out after ${timeout}ms`, "TIMEOUT");
  }

  /**
   * Create a generic error from unknown error
   */
  static from(error: unknown, context?: string): ChainwebClientError {
    if (error instanceof ChainwebClientError) {
      return error;
    }
    if (error instanceof Error) {
      const message = context ? `${context}: ${error.message}` : error.message;
      return new ChainwebClientError(message, "NETWORK_ERROR", undefined, undefined, error);
    }
    const message = context ? `${context}: Unknown error` : "Unknown error";
    return new ChainwebClientError(message, "NETWORK_ERROR", undefined, undefined, error);
  }

  /**
   * Create HTTP error
   */
  static http(status: number, statusText: string, response?: any): ChainwebClientError {
    return new ChainwebClientError(`HTTP ${status}: ${statusText}`, "HTTP_ERROR", status, response);
  }

  /**
   * Create parse error
   */
  static parse(message: string, response?: any): ChainwebClientError {
    return new ChainwebClientError(message, "PARSE_ERROR", undefined, response);
  }

  /**
   * Create validation error
   */
  static validation(message: string): ChainwebClientError {
    return new ChainwebClientError(message, "VALIDATION_ERROR");
  }

  /**
   * Create transaction error
   */
  static transaction(message: string, requestKey?: string): ChainwebClientError {
    return new ChainwebClientError(message, "TRANSACTION_ERROR", undefined, { requestKey });
  }
}

/**
 * Error codes for ChainwebClient
 */
export type ChainwebErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "TRANSACTION_ERROR";
