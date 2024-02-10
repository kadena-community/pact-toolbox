import type { ChainwebLocalNetworkConfig, ChainwebMiningClientConfig, ChainwebNodeConfig } from '@pact-toolbox/config';
import { createChainWebMiningClientConfig, createChainwebNodeConfig } from '@pact-toolbox/config';
import { pollFn, runBin } from '@pact-toolbox/utils';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { logger } from '../../utils/src/logger';
import { createProxyServer } from './proxyServer';
import { ProcessWrapper } from './types';
import { didMakeBlocks, isChainWebAtHeight, isChainWebNodeOk } from './utils';

const chainwebNodeBin = 'chainweb-node';
const chainwebMiningClientBin = 'chainweb-mining-client';

export async function startChainWebNode(config: ChainwebNodeConfig, silent = true) {
  return runBin(
    chainwebNodeBin,
    [
      `--config-file=${config.configFile}`,
      `--p2p-certificate-chain-file=${config.p2pCertificateChainFile}`,
      `--p2p-certificate-key-file=${config.p2pCertificateKeyFile}`,
      `--p2p-hostname=${config.p2pHostname}`,
      `--bootstrap-reachability=${config.bootstrapReachability}`,
      `--cluster-id=${config.clusterId}`,
      `--p2p-max-session-count=${config.p2pMaxSessionCount}`,
      `--mempool-p2p-max-session-count=${config.mempoolP2pMaxSessionCount}`,
      `--known-peer-info=${config.knownPeerInfo}`,
      `--log-level=${config.logLevel}`,
      `--mining-public-key=${config.miningPublicKey}`,
      `--service-port=${config.servicePort}`,
      `--database-directory=${config.databaseDirectory}`,
      config.headerStream ? `--header-stream` : '',
      config.rosetta ? `--rosetta` : '',
      config.allowReadsInLocal ? `--allowReadsInLocal` : '',
      config.disablePow ? `--disable-pow` : '',
      config.enableMiningCoordination ? `--enable-mining-coordination` : '',
    ].filter(Boolean),
    { silent },
  );
}

export async function startChainWebMiningClient(config: ChainwebMiningClientConfig, silent = true) {
  return runBin(
    chainwebMiningClientBin,
    [
      `--public-key=${config.publicKey}`,
      `--node=${config.node}`,
      `--worker=${config.worker}`,
      `--on-demand-port=${config.onDemandPort}`,
      // `--constant-delay-block-time=${config.constantDelayBlockTime}`,
      `--thread-count=${config.threadCount}`,
      `--log-level=${config.logLevel}`,
      config.noTls ? `--no-tls` : '',
    ],
    { silent },
  );
}

export async function startChainWeb(network: ChainwebLocalNetworkConfig, silent = true) {
  const nodeConfig = createChainwebNodeConfig(network.nodeConfig);
  const miningClientConfig = createChainWebMiningClientConfig(network.miningClientConfig);
  const proxyPort = network.proxyPort ?? 8080;
  const isOnDemand = miningClientConfig.worker === 'on-demand';
  const onDemandPort = miningClientConfig.onDemandPort;
  // clean up old db
  if (!nodeConfig.persistDb && existsSync(nodeConfig.databaseDirectory)) {
    await rm(nodeConfig.databaseDirectory, { recursive: true, force: true });
  }

  const onDemandUrl = `http://localhost:${onDemandPort}`;
  const nodeUrl = `http://localhost:${nodeConfig.servicePort}`;
  const { stop: stopProxyServer, start: startProxyServer } = await createProxyServer({
    port: proxyPort,
    detentionUrl: nodeUrl,
    onDemandUrl: isOnDemand ? onDemandUrl : undefined,
  });

  await startProxyServer();

  const chainwebNode = await startChainWebNode(nodeConfig, silent);
  await pollFn(() => isChainWebNodeOk(proxyPort), 10000);
  logger.success('Chainweb node started');
  const miningClient = await startChainWebMiningClient(miningClientConfig, silent);
  logger.success('Mining client started');

  const stop = async () => {
    chainwebNode.kill();
    miningClient.kill();
    await stopProxyServer();
    await rm(nodeConfig.databaseDirectory, { recursive: true, force: true });
  };

  const dockerProcess: ProcessWrapper = {
    stop,
    id: chainwebNode.pid?.toString(),
  };

  try {
    if (isOnDemand) {
      await pollFn(
        () =>
          didMakeBlocks({
            count: 5,
            onDemandUrl,
          }),
        10000,
        15,
      );
    }
    await pollFn(() => isChainWebAtHeight(20, proxyPort), 10000);
    logger.success('Chainweb network is ready');
  } catch (e) {
    await stop();
    logger.fatal('Chainweb did not start in time');
  }

  return dockerProcess;
}
