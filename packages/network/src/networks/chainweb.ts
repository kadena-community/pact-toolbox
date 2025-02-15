import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import type { ChainwebMiningClientConfig, ChainwebNodeConfig, LocalChainwebNetworkConfig } from "@pact-toolbox/config";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "pathe";

import { createChainWebMiningClientConfig, createChainwebNodeConfig } from "@pact-toolbox/config";
import { didMakeBlocks, getUuid, isChainWebAtHeight, isChainWebNodeOk, pollFn, runBin } from "@pact-toolbox/utils";

import type { ToolboxNetworkApi } from "../types";

const chainwebNodeBin = "chainweb-node";
const chainwebMiningClientBin = "chainweb-mining-client";

export async function startChainWebNode(
  config: ChainwebNodeConfig,
  id: string,
  silent = true,
): Promise<ChildProcessWithoutNullStreams> {
  const knownPeerInfo = config.knownPeerInfo.replace(/:\d+/, `:${config.p2pPort}`);
  return runBin(
    chainwebNodeBin,
    [
      `--config-file=${config.configFile}`,
      `--p2p-certificate-chain-file=${config.p2pCertificateChainFile}`,
      `--p2p-certificate-key-file=${config.p2pCertificateKeyFile}`,
      `--p2p-hostname=${config.p2pHostname}`,
      `--p2p-port=${config.p2pPort}`,
      `--bootstrap-reachability=${config.bootstrapReachability}`,
      `--cluster-id=${config.clusterId}`,
      `--p2p-max-session-count=${config.p2pMaxSessionCount}`,
      `--mempool-p2p-max-session-count=${config.mempoolP2pMaxSessionCount}`,
      `--known-peer-info=${knownPeerInfo}`,
      `--log-level=${config.logLevel}`,
      `--mining-public-key=${config.miningPublicKey}`,
      `--service-port=${config.servicePort}`,
      `--database-directory=${join(config.databaseDirectory, id)}`,
      config.headerStream ? `--header-stream` : "",
      config.allowReadsInLocal ? `--allowReadsInLocal` : "",
      config.disablePow ? `--disable-pow` : "",
      config.enableMiningCoordination ? `--enable-mining-coordination` : "",
    ].filter(Boolean),
    { silent },
  );
}

export async function startChainWebMiningClient(
  config: ChainwebMiningClientConfig,
  node: string,
  silent = true,
): Promise<ChildProcessWithoutNullStreams> {
  return runBin(
    chainwebMiningClientBin,
    [
      `--public-key=${config.publicKey}`,
      `--node=${node}`,
      `--worker=${config.worker}`,
      `--on-demand-port=${config.onDemandPort}`,
      `--stratum-port=${config.stratumPort}`,
      `--constant-delay-block-time=${config.constantDelayBlockTime}`,
      `--thread-count=${config.threadCount}`,
      `--log-level=${config.logLevel}`,
      config.noTls ? `--no-tls` : "",
    ],
    { silent },
  );
}

export class LocalChainwebNetwork implements ToolboxNetworkApi {
  public id: string = getUuid();
  private chainwebNodeProcess?: ChildProcessWithoutNullStreams;
  private miningClientProcess?: ChildProcessWithoutNullStreams;
  private nodeConfig: ChainwebNodeConfig;
  private miningClientConfig: ChainwebMiningClientConfig;

  constructor(
    private network: LocalChainwebNetworkConfig,
    private silent = true,
    private isStateless: boolean = false,
  ) {
    this.nodeConfig = createChainwebNodeConfig(this.network.nodeConfig);
    this.miningClientConfig = createChainWebMiningClientConfig(this.network.miningClientConfig);
  }

  getServicePort(): number {
    return this.nodeConfig.servicePort;
  }

  hasOnDemandMining(): boolean {
    return this.miningClientConfig.worker === "on-demand";
  }

  getOnDemandMiningUrl() {
    return `http://localhost:${this.miningClientConfig.onDemandPort}`;
  }

  getServiceUrl() {
    return `http://localhost:${this.nodeConfig.servicePort}`;
  }

  async isOk(): Promise<boolean> {
    return isChainWebNodeOk(this.getServiceUrl());
  }

  async start(): Promise<void> {
    // clean up old db
    const dbDir = join(this.nodeConfig.databaseDirectory, this.isStateless ? this.id : "");
    if (!this.nodeConfig.persistDb && existsSync(dbDir)) {
      await rm(dbDir, { recursive: true, force: true });
    }
    this.chainwebNodeProcess = await startChainWebNode(this.nodeConfig, this.isStateless ? this.id : "", this.silent);
    await pollFn(() => isChainWebNodeOk(this.getServiceUrl()), {
      timeout: 10000,
    });
    const node = `127.0.0.1:${this.nodeConfig.servicePort}`;
    this.miningClientProcess = await startChainWebMiningClient(this.miningClientConfig, node, this.silent);

    if (this.hasOnDemandMining()) {
      try {
        await pollFn(
          () =>
            didMakeBlocks({
              count: 5,
              onDemandUrl: this.getOnDemandMiningUrl(),
            }),
          {
            timeout: 10000,
          },
        );
      } catch (e) {
        throw new Error("Could not make initial blocks for on-demand mining");
      }
    }

    try {
      await pollFn(() => isChainWebAtHeight(20, this.getServiceUrl()), {
        timeout: 10000,
      });
    } catch (e) {
      throw new Error("Chainweb node did not reach height 20");
    }
  }

  async stop(): Promise<void> {
    this.chainwebNodeProcess?.kill();
    this.miningClientProcess?.kill();
    await rm(this.nodeConfig.databaseDirectory, {
      recursive: true,
      force: true,
    });
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
}

export async function startLocalChainWebNetwork(
  network: LocalChainwebNetworkConfig,
  silent = true,
): Promise<LocalChainwebNetwork> {
  const process = new LocalChainwebNetwork(network, silent);
  await process.start();
  return process;
}
