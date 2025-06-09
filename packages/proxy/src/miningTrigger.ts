import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import { EventEmitter } from "events";
import { ConfirmationScheduler, type ConfirmationDemands, type ChainId } from "./triggerState";
import type { H3 } from "h3-nightly";

const ALL_CHAINS: ChainId[] = Array.from({ length: 20 }, (_, i) => i);

export interface Logger {
  info: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

// Interface for a component that can make block requests
// This allows consumers to provide their own implementation if needed (e.g. for testing or different transport)
export interface BlockRequester {
  requestBlocks: (chainIds: ChainId[], count: number) => Promise<void>;
}

export interface MiningTriggerConfig {
  miningClientUrl: string;
  chainwebServiceEndpoint: string;
  idleTriggerPeriodSec: number;
  confirmationTriggerPeriodSec: number;
  transactionBatchPeriodSec: number;
  miningCooldownSec: number;
  defaultConfirmationCount: number;
  disableIdleWorker: boolean;
  disableConfirmationWorker: boolean;
  devRequestLogger: boolean; // For the internal Express server
  logger?: Logger; // Optional custom logger
  blockRequester?: BlockRequester; // Optional custom block requester
}

// Default logger if none provided
const defaultLogger: Logger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message, ...args) => console.log(`[DEBUG] ${message}`, ...args),
};

export class DefaultBlockRequester implements BlockRequester {
  private client: AxiosInstance;
  private logger: Logger;
  private miningClientUrl: string;

  constructor(miningClientUrl: string, logger: Logger) {
    this.miningClientUrl = miningClientUrl;
    this.logger = logger;
    this.client = axios.create();
  }

  async requestBlocks(chainIds: ChainId[], count: number): Promise<void> {
    if (chainIds.length === 0) {
      return;
    }
    const body = chainIds.reduce(
      (acc, cid) => {
        acc[cid.toString()] = count; // Ensure keys are strings for JSON
        return acc;
      },
      {} as Record<string, number>,
    );

    const url = `${this.miningClientUrl}/make-blocks`;
    try {
      this.logger.debug(`Requesting ${count} block(s) on chain(s) ${chainIds.join(", ")} from ${url}`);
      const response = await this.client.post(url, body, {
        headers: { "Content-Type": "application/json" },
      });
      if (response.status === 200) {
        this.logger.info(`Successfully requested blocks. Chains: ${chainIds.join(", ")}, Count: ${count}`);
      } else {
        this.logger.warn(
          `Failed to request blocks. Status: ${response.status}, Chains: ${chainIds.join(
            ", ",
          )}, Count: ${count}, Response: ${JSON.stringify(response.data)}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Error requesting blocks: ${error.message}, Chains: ${chainIds.join(", ")}, Count: ${count}`);
      if (error.response) {
        this.logger.error(`Error details: ${JSON.stringify(error.response.data)}`);
      }
      throw error; // Re-throw for the caller to handle if necessary
    }
  }
}

export class MiningTrigger extends EventEmitter {
  private logger: Logger;
  private blockRequester: BlockRequester;
  private confirmationScheduler: ConfirmationScheduler;
  private workerIntervals: NodeJS.Timeout[] = [];
  private activityPromiseResolve: (() => void) | null = null;
  private isRunning: boolean = false;
  private confirmationWorkerAbortController: AbortController | null = null;
  private idleWorkerAbortController: AbortController | null = null;

  constructor(
    private app: H3,
    private config: MiningTriggerConfig,
  ) {
    super();
    this.logger = config.logger || defaultLogger;
    this.blockRequester = config.blockRequester || new DefaultBlockRequester(config.miningClientUrl, this.logger);
    this.confirmationScheduler = new ConfirmationScheduler();
  }

  private reportActivity() {
    this.emit("activity");
    if (this.activityPromiseResolve) {
      this.activityPromiseResolve();
      this.activityPromiseResolve = null;
    }
  }

  private async waitActivity(timeoutMs: number, signal: AbortSignal): Promise<"activity" | "timeout" | "aborted"> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve("aborted");
        return;
      }

      const timer = setTimeout(() => {
        if (this.activityPromiseResolve) {
          this.activityPromiseResolve = null;
        }
        resolve("timeout");
      }, timeoutMs);

      const abortListener = () => {
        clearTimeout(timer);
        if (this.activityPromiseResolve) {
          this.activityPromiseResolve = null;
        }
        resolve("aborted");
      };
      signal.addEventListener("abort", abortListener);

      this.activityPromiseResolve = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abortListener);
        resolve("activity");
      };
    });
  }

  private async registerTransactionProxyHandler(): Promise<void> {
    // if (this.server) {
    //   this.logger.warn("Transaction proxy server already running.");
    //   return;
    // }
    // if (this.config.devRequestLogger) {
    //   app.use(morgan("dev"));
    // }
    // app.use(cors());
    // app.use(express.json());

    this.app.post("/chainweb/0.0/:networkId/chain/:chainId/pact/api/v1/send", async (event) => {
      console.log("HELLO WORLD", event);
      const { networkId, chainId: chainIdStr } = event.context.params as { networkId: string; chainId: string };
      const chainId = parseInt(chainIdStr, 10);

      this.logger.debug(`Received transaction for network ${networkId}, chain ${chainId}`);
      const body = await event.req.json();
      this.emit("transactionReceived", {
        networkId,
        chainId,
        body,
      });

      try {
        const downstreamUrl = `${this.config.chainwebServiceEndpoint}/chainweb/0.0/${networkId}/chain/${chainIdStr}/pact/api/v1/send`;
        this.logger.debug(`Proxying to ${downstreamUrl}`);

        const proxyRes: AxiosResponse = await axios.post(downstreamUrl, body, {
          headers: {
            ...Object.fromEntries(
              Object.entries(event.req.headers).filter(
                ([key]) => !["host", "transfer-encoding", "connection"].includes(key.toLowerCase()),
              ),
            ),
            "Content-Type": "application/json",
          },
          validateStatus: () => true,
        });

        this.logger.debug(`Proxied request to ${downstreamUrl}, status: ${proxyRes.status}`);
        this.emit("transactionProxied", {
          networkId,
          chainId,
          status: proxyRes.status,
          responseBody: proxyRes.data,
        });

        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (!["transfer-encoding", "access-control-allow-origin"].includes(key.toLowerCase()) && value) {
            event.res.headers.set(key, value);
          }
        });
        event.res.status = proxyRes.status;

        if (proxyRes.status === 200 && this.config.defaultConfirmationCount > 0) {
          this.logger.info(`Transaction accepted for chain ${chainId}. Pushing to ConfirmationScheduler.`);
          await this.confirmationScheduler.pushTransaction(
            this.config.transactionBatchPeriodSec * 1000,
            chainId,
            this.config.defaultConfirmationCount,
          );
          this.reportActivity();
        } else if (proxyRes.status !== 200) {
          this.logger.warn(
            `Proxy request failed or transaction not accepted (status ${proxyRes.status}) for chain ${chainId}.`,
          );
        } else {
          this.logger.info(`Not requesting blocks due to confirmation count = ${this.config.defaultConfirmationCount}`);
        }
        return proxyRes.data;
      } catch (error: any) {
        this.logger.error(`Error proxying transaction for chain ${chainId}: ${error.message}`);
        this.emit("error", new Error(`ProxyError: ${error.message}`), {
          context: "transactionProxy",
          chainId,
        });
        if (error.response) {
          this.logger.error(`Proxy error response: ${JSON.stringify(error.response.data)}`);
          event.res.status = error.response.status || 500;
          event.res.statusText = error.response.statusText || "Internal Server Error";
        } else {
          event.res.status = 500;
          event.res.statusText = "Internal Server Error";
        }
        return error.response.data;
      }
    });
  }

  private async confirmationWorker(signal: AbortSignal): Promise<void> {
    this.logger.info("Confirmation Trigger Worker started");
    while (!signal.aborted) {
      try {
        const demands: ConfirmationDemands = await this.confirmationScheduler.waitNextDemands(
          this.config.confirmationTriggerPeriodSec * 1000,
        );
        if (signal.aborted) break;

        this.reportActivity();

        if (demands.chains.length > 0) {
          this.logger.info(
            `Confirmation Trigger: Triggered for chains: ${demands.chains.join(
              ", ",
            )}, confirmations: ${demands.confirmations}`,
          );
          this.emit("confirmationTrigger", demands);
          for (let i = 0; i < demands.confirmations; i++) {
            if (signal.aborted) break;
            await this.blockRequester.requestBlocks(demands.chains, 1);
            this.emit("blocksRequested", {
              chainIds: demands.chains,
              count: 1,
              reason: "confirmation",
            });
            if (i < demands.confirmations - 1) {
              await new Promise((resolve) => setTimeout(resolve, this.config.miningCooldownSec * 1000));
            }
          }
        }
      } catch (error: any) {
        if (signal.aborted) break;
        this.logger.error(`Confirmation Trigger Worker error: ${error.message}`);
        this.emit("error", error, { context: "confirmationWorker" });
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Avoid busy-looping
      }
    }
    this.logger.info("Confirmation Trigger Worker stopped");
  }

  private async idleWorker(signal: AbortSignal): Promise<void> {
    this.logger.info("Idle Trigger Worker started");
    const periodicBlocksDelayMs = this.config.idleTriggerPeriodSec * 0.616 * 1000;
    while (!signal.aborted) {
      try {
        const result = await this.waitActivity(periodicBlocksDelayMs, signal);
        if (result === "aborted") break;

        if (result === "timeout") {
          const randomChainId = ALL_CHAINS[Math.floor(Math.random() * ALL_CHAINS.length)]!;
          this.logger.info(`Idle Trigger: Requesting 1 block on chain ${randomChainId}`);
          await this.blockRequester.requestBlocks([randomChainId], 1);
          this.emit("blocksRequested", {
            chainIds: [randomChainId],
            count: 1,
            reason: "idle",
          });
        } else {
          this.logger.debug("Idle Trigger: Activity detected, resetting timer.");
        }
      } catch (error: any) {
        if (signal.aborted) break;
        this.logger.error(`Idle Trigger Worker error: ${error.message}`);
        this.emit("error", error, { context: "idleWorker" });
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
    this.logger.info("Idle Trigger Worker stopped");
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("MiningTrigger is already running.");
      return;
    }
    this.logger.info("Starting MiningTrigger...");

    try {
      // Initial block request
      this.logger.info("Performing initial block request...");
      await this.blockRequester.requestBlocks(ALL_CHAINS, 2);
      this.emit("blocksRequested", {
        chainIds: ALL_CHAINS,
        count: 2,
        reason: "initialization",
      });

      if (this.config.idleTriggerPeriodSec <= 0) {
        throw new Error("Idle trigger period must be positive.");
      }

      // Start transaction proxy server
      await this.registerTransactionProxyHandler();

      const workerPromises: Promise<void>[] = [];

      if (!this.config.disableConfirmationWorker) {
        this.confirmationWorkerAbortController = new AbortController();
        workerPromises.push(this.confirmationWorker(this.confirmationWorkerAbortController.signal));
      }

      if (!this.config.disableIdleWorker) {
        this.idleWorkerAbortController = new AbortController();
        workerPromises.push(this.idleWorker(this.idleWorkerAbortController.signal));
      }

      this.isRunning = true;
      this.logger.info("MiningTrigger started successfully.");
      this.emit("started");

      // Do not await workerPromises here as they are long-running.
      // Handle their errors via emitted 'error' events or manage them if they can complete.
      Promise.allSettled(workerPromises).then((results) => {
        results.forEach((result) => {
          if (result.status === "rejected") {
            this.logger.error("A worker promise was rejected:", result.reason);
            this.emit("error", result.reason, {
              context: "workerPromiseSettled",
            });
          }
        });
      });
    } catch (error: any) {
      this.logger.error("Failed to start MiningTrigger:", error);
      this.emit("error", error, { context: "start" });
      await this.stop(); // Attempt to clean up if start failed
      throw error; // Re-throw for the caller
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      // Also check server in case start failed mid-way
      this.logger.info("MiningTrigger is not running.");
      return;
    }
    this.logger.info("Stopping MiningTrigger...");

    this.confirmationWorkerAbortController?.abort();
    this.idleWorkerAbortController?.abort();

    // // Stop the transaction proxy server
    // if (this.server) {
    //   await new Promise<void>((resolve, reject) => {
    //     this.server!.close((err) => {
    //       if (err) {
    //         this.logger.error("Error stopping transaction proxy server:", err);
    //         this.emit("error", err, { context: "stopServer" });
    //         reject(err);
    //         return;
    //       }
    //       this.logger.info("Transaction proxy server stopped.");
    //       this.server = null;
    //       this.app = null;
    //       resolve();
    //     });
    //   });
    // }

    // Clear any pending timeouts/intervals (though AbortController should handle loops)
    this.workerIntervals.forEach(clearInterval);
    this.workerIntervals = [];

    if (this.activityPromiseResolve) {
      this.activityPromiseResolve(); // Resolve any pending waitActivity
    }

    this.isRunning = false;
    this.logger.info("MiningTrigger stopped.");
    this.emit("stopped");
  }
}
