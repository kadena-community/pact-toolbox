import type { SignedTransaction } from "@pact-toolbox/types";
import type {
  NetworkConfig,
  SendResult,
  ListenResult,
  TransactionResult,
  LocalResult,
  PollRequest,
  PollResponse,
  BatchResult,
  NetworkInfo,
  ChainInfo,
  CutInfo,
  HealthCheck,
  RequestConfig,
} from "./types";
import { ChainwebClientError } from "./types";

/**
 * Fast, lightweight client for Chainweb and Pact APIs
 *
 * Simple, powerful API for interacting with Kadena blockchain.
 * Works across web, Node.js, and React Native environments.
 */
export class ChainwebClient {
  private config: Required<NetworkConfig>;

  constructor(config: NetworkConfig) {
    this.config = {
      timeout: 30000,
      headers: {},
      ...config,
    };
  }

  /**
   * Send transactions to chainweb
   */
  async send(transactions: SignedTransaction[], config?: RequestConfig): Promise<SendResult> {
    const url = this.buildApiUrl("/send");
    const payload = {
      cmds: transactions.map((tx) => ({
        hash: tx.hash,
        sigs: tx.sigs,
        cmd: tx.cmd,
      })),
    };

    const response = await this.makeRequest(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
          ...config?.headers,
        },
        body: JSON.stringify(payload),
      },
      config,
    );

    if (!response.requestKeys || !Array.isArray(response.requestKeys)) {
      throw ChainwebClientError.parse("Invalid response: missing or invalid request keys", response);
    }

    return {
      requestKeys: response.requestKeys,
      response,
    };
  }

  /**
   * Poll for transaction results
   */
  async poll(requestKeys: string[], config?: RequestConfig): Promise<PollResponse> {
    if (!requestKeys.length) {
      throw ChainwebClientError.validation("Request keys array cannot be empty");
    }

    const url = this.buildApiUrl("/poll");
    const payload: PollRequest = { requestKeys };

    return this.makeRequest(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
          ...config?.headers,
        },
        body: JSON.stringify(payload),
      },
      config,
    );
  }

  /**
   * Listen for a single transaction result
   */
  async listen(requestKey: string, config?: RequestConfig): Promise<ListenResult> {
    if (!requestKey) {
      throw ChainwebClientError.validation("Request key cannot be empty");
    }

    const url = this.buildApiUrl("/listen");
    const payload = { listen: requestKey };

    const response = await this.makeRequest(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
          ...config?.headers,
        },
        body: JSON.stringify(payload),
      },
      config,
    );

    return {
      requestKey,
      result: response,
    };
  }

  /**
   * Execute local query (read-only)
   */
  async local(command: any, config?: RequestConfig): Promise<LocalResult> {
    const url = this.buildApiUrl("/local");

    return this.makeRequest(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
          ...config?.headers,
        },
        body: JSON.stringify(command),
      },
      config,
    );
  }

  /**
   * Submit transaction and wait for result
   */
  async submitAndWait(
    transaction: SignedTransaction,
    pollInterval = 5000,
    config?: RequestConfig,
  ): Promise<TransactionResult> {
    const sendResult = await this.send([transaction], config);
    const requestKey = sendResult.requestKeys[0];

    if (!requestKey) {
      throw ChainwebClientError.transaction("No request key returned from send");
    }

    return this.waitForResult(requestKey, pollInterval, config);
  }

  /**
   * Submit multiple transactions in batches and wait for results
   */
  async submitBatch(
    transactions: SignedTransaction[],
    options: {
      batchSize?: number;
      pollInterval?: number;
      config?: RequestConfig;
    } = {},
  ): Promise<BatchResult<TransactionResult>> {
    const { batchSize = 10, pollInterval = 5000, config } = options;

    if (!transactions.length) {
      return {
        successes: [],
        failures: [],
        total: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    const successes: TransactionResult[] = [];
    const failures: Array<{ error: ChainwebClientError; index: number }> = [];

    // Process transactions in batches
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);

      try {
        const sendResult = await this.send(batch, config);
        const results = await Promise.all(
          sendResult.requestKeys.map((requestKey) => this.waitForResult(requestKey, pollInterval, config)),
        );
        successes.push(...results);
      } catch (error) {
        // Add failure for each transaction in the failed batch
        for (let j = 0; j < batch.length; j++) {
          failures.push({
            error: ChainwebClientError.from(error, "Batch processing failed"),
            index: i + j,
          });
        }
      }
    }

    return {
      successes,
      failures,
      total: transactions.length,
      successCount: successes.length,
      failureCount: failures.length,
    };
  }

  /**
   * Get transaction details by request key
   */
  async getTransaction(requestKey: string, config?: RequestConfig): Promise<TransactionResult | null> {
    try {
      const pollResponse = await this.poll([requestKey], config);
      return pollResponse[requestKey] || null;
    } catch (error) {
      if (error instanceof ChainwebClientError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if network is healthy
   */
  async healthCheck(config?: RequestConfig): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const rpcUrl = this.config.rpcUrl(this.config.networkId, this.config.chainId);
      const isChainwebNode = rpcUrl.includes("chainweb");
      const url = isChainwebNode ? `${rpcUrl}/health-check` : `${rpcUrl}/version`;
      await this.makeRequest(url, { method: "GET" }, config);

      return {
        healthy: true,
        timestamp: startTime,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        timestamp: startTime,
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Get network information
   */
  async getNetworkInfo(config?: RequestConfig): Promise<NetworkInfo> {
    const url = `${this.config.rpcUrl(this.config.networkId, this.config.chainId)}/info`;
    const response = await this.makeRequest(url, { method: "GET" }, config);

    return {
      networkId: this.config.networkId,
      chainwebVersion: response.chainwebVersion || "unknown",
      chainCount: response.chainCount || 0,
      chains: response.chains || [],
      startTime: response.startTime,
    };
  }

  /**
   * Get cut (current chain information)
   */
  async getCut(config?: RequestConfig): Promise<CutInfo> {
    const url = `${this.config.rpcUrl(this.config.networkId, this.config.chainId)}/chainweb/0.0/${this.config.networkId}/cut`;
    const response = await this.makeRequest(url, { method: "GET" }, config);

    return {
      height: response.height || 0,
      weight: response.weight || "0",
      hash: response.hash || "",
      chains: response.hashes || {},
    };
  }

  /**
   * Get chain information
   */
  async getChainInfo(chainId?: string, config?: RequestConfig): Promise<ChainInfo> {
    const targetChain = chainId || this.config.chainId;
    const cut = await this.getCut(config);
    const chainInfo = cut.chains[targetChain];

    if (!chainInfo) {
      throw ChainwebClientError.validation(`Chain ${targetChain} not found`);
    }

    return chainInfo;
  }

  /**
   * Create a new client with different configuration
   */
  withConfig(newConfig: Partial<NetworkConfig>): ChainwebClient {
    return new ChainwebClient({
      ...this.config,
      ...newConfig,
    });
  }

  /**
   * Create a client for a different chain
   */
  forChain(chainId: string): ChainwebClient {
    return this.withConfig({ chainId });
  }

  /**
   * Create a client for a different network
   */
  forNetwork(networkId: string): ChainwebClient {
    return this.withConfig({ networkId });
  }

  /**
   * Wait for transaction result by polling
   */
  private async waitForResult(
    requestKey: string,
    pollInterval: number,
    config?: RequestConfig,
  ): Promise<TransactionResult> {
    const maxAttempts = 60; // 5 minutes with 5s interval
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const pollResponse = await this.poll([requestKey], config);
        if (pollResponse[requestKey]) {
          return pollResponse[requestKey];
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch {
        // Try listen endpoint as fallback
        try {
          const listenResult = await this.listen(requestKey, config);
          return listenResult.result;
        } catch {
          if (attempts >= maxAttempts) {
            throw ChainwebClientError.transaction(
              `Failed to get transaction result after ${attempts} attempts`,
              requestKey,
            );
          }
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
      }
    }

    throw ChainwebClientError.timeout(maxAttempts * pollInterval);
  }

  /**
   * Build API URL for Pact endpoints
   */
  private buildApiUrl(endpoint: string): string {
    const baseUrl = this.config.rpcUrl(this.config.networkId, this.config.chainId);
    return `${baseUrl}/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  }

  /**
   * Make HTTP request with timeout
   */
  private async makeRequest(url: string, options: RequestInit, config?: RequestConfig): Promise<any> {
    const requestConfig = {
      timeout: this.config.timeout,
      ...config,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestConfig.timeout);

      const response = await fetch(url, {
        ...options,
        signal: config?.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw ChainwebClientError.http(response.status, response.statusText, errorText);
      }

      const contentType = response.headers.get("content-type");
      return contentType && contentType.includes("application/json") ? await response.json() : await response.text();
    } catch (error) {
      if (error instanceof ChainwebClientError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw ChainwebClientError.timeout(requestConfig.timeout);
        }
        throw ChainwebClientError.network(error.message, error);
      }

      throw ChainwebClientError.network("Unknown network error", error);
    }
  }
}
