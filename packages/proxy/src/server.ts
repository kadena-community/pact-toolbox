import type { Listener, ListenOptions } from "listhen";
import { listen } from "listhen";

import { logger } from "@pact-toolbox/utils";
import { H3, toNodeHandler } from "h3-nightly";
import { MiningTrigger } from "./miningTrigger";
import type { PactToolboxNetworkApiLike } from "./types";
export interface CreateDevProxyServerOptions extends Partial<ListenOptions> {
  port?: number;
}

export class PactToolboxDevProxyServer {
  private app = new H3();
  private listener?: Listener;
  private miningTrigger: MiningTrigger;

  constructor(
    private network: PactToolboxNetworkApiLike,
    private options: CreateDevProxyServerOptions,
  ) {
    this.miningTrigger = new MiningTrigger(this.app, {
      miningClientUrl: network.getMiningClientUrl(),
      chainwebServiceEndpoint: network.getNodeServiceUrl(),
      idleTriggerPeriodSec: 10,
      confirmationTriggerPeriodSec: 10,
      transactionBatchPeriodSec: 10,
      miningCooldownSec: 10,
      defaultConfirmationCount: 10,
      disableIdleWorker: true,
      disableConfirmationWorker: true,
      devRequestLogger: false,
      logger,
    });
    // setupRoutes(this.router, network);
  }

  async start(): Promise<Listener> {
    // setupWildCardProxy(this.app, this.network);
    try {
      this.listener = await listen(toNodeHandler(this.app), {
        isProd: true,
        showURL: false,
        ...this.options,
        port: this.options.port ?? 8080,
      });
      await this.miningTrigger.start();
    } catch (error) {
      logger.error("Failed to start proxy server", error);
      throw error;
    }
    return this.listener;
  }

  async stop(): Promise<void> {
    await this.listener?.close();
    await this.miningTrigger.stop();
  }
}

export function createDevProxyServer(
  network: PactToolboxNetworkApiLike,
  options: CreateDevProxyServerOptions,
): PactToolboxDevProxyServer {
  return new PactToolboxDevProxyServer(network, options);
}
