import type { ContainerConfig } from "@pact-toolbox/container-orchestrator";
import {
  CHAINWEB_NODE_IMAGE,
  P2P_PORT,
  MINER_PUBLIC_KEY,
  MINING_CLIENT_IMAGE,
  MINING_CLIENT_PORT,
  DEVNET_PUBLIC_PORT,
  MINIMAL_CLUSTER_ID,
  MINIMAL_NETWORK_NAME,
  MINING_TRIGGER_IMAGE,
  NODE_SERVICE_PORT,
  MINING_CLIENT_SERVICE_NAME,
  MINING_TRIGGER_SERVICE_NAME,
  BOOTSTRAP_NODE_SERVICE_NAME,
  API_PROXY_SERVICE_NAME,
  MINING_TRIGGER_PORT,
  DEVNET_CONFIGS_DIR,
} from "../config/constants";
import type { DevNetServiceDefinition } from "../types";
import type { DevNetMiningConfig } from "@pact-toolbox/config";

interface ChainwebNodeServiceOptions {
  image: string;
  clusterId: string;
  networkName: string;
  persistDb?: boolean;
  nodeServicePort?: number;
  p2pPort?: number;
  volume?: string;
}

export function createChainwebNodeService({
  image = CHAINWEB_NODE_IMAGE,
  clusterId = "devnet-minimal",
  persistDb = true,
  nodeServicePort = NODE_SERVICE_PORT,
  p2pPort = P2P_PORT,
  volume = `devnet_db_${clusterId.replace("-", "_")}`,
}: Partial<ChainwebNodeServiceOptions>): ContainerConfig {
  return {
    id: BOOTSTRAP_NODE_SERVICE_NAME,
    name: BOOTSTRAP_NODE_SERVICE_NAME,
    image: image.split(':')[0] || image,
    tag: image.split(':')[1] || 'latest',
    labels: {
      "com.chainweb.devnet.description": "Devnet Bootstrap Node",
      "com.chainweb.devnet.node": "",
      "com.chainweb.devnet.bootstrap-node": "",
    },
    restart: "unless-stopped",
    volumes: [
      persistDb ? { host: volume, container: "/chainweb/db", mode: "rw" } : undefined,
      { host: `${DEVNET_CONFIGS_DIR}/devnet-bootstrap-node.cert.pem`, container: "/chainweb/devnet-bootstrap-node.cert.pem", mode: "ro" },
      { host: `${DEVNET_CONFIGS_DIR}/devnet-bootstrap-node.key.pem`, container: "/chainweb/devnet-bootstrap-node.key.pem", mode: "ro" },
      { host: `${DEVNET_CONFIGS_DIR}/chainweb-node.common.yaml`, container: "/chainweb/config/chainweb-node.common.yaml", mode: "ro" },
      { host: `${DEVNET_CONFIGS_DIR}/chainweb-node.logging.yaml`, container: "/chainweb/config/chainweb-node.logging.yaml", mode: "ro" },
    ].filter(Boolean) as ContainerConfig['volumes'],
    entrypoint: [
      "/chainweb/chainweb-node",
      "+RTS",
      "-T",
      "-H400M",
      "-A64M",
      "-RTS",
      "--config-file=config/chainweb-node.common.yaml",
      "--config-file=config/chainweb-node.logging.yaml",
    ],
    command: [
      "--p2p-certificate-chain-file=/chainweb/devnet-bootstrap-node.cert.pem",
      "--p2p-certificate-key-file=/chainweb/devnet-bootstrap-node.key.pem",
      `--p2p-hostname=${BOOTSTRAP_NODE_SERVICE_NAME}`,
      "--bootstrap-reachability=1",
      `--cluster-id=${clusterId}`,
      "--p2p-max-session-count=2",
      "--mempool-p2p-max-session-count=10",
      `--known-peer-info=YNo7pXthYQ9RQKv1bbpQf2R5LcLYA3ppx2BL2Hf8fIM@${BOOTSTRAP_NODE_SERVICE_NAME}:${p2pPort}`,
      "--log-level=info",
      "--enable-mining-coordination",
      `--mining-public-key=${MINER_PUBLIC_KEY}`,
      "--header-stream",
      "--allowReadsInLocal",
      "--database-directory=/chainweb/db",
      "--disable-pow",
    ],
    env: { DISABLE_POW_VALIDATION: "true" },
    healthCheck: {
      test: [
        "CMD",
        "/bin/bash",
        "-c",
        `exec 3<>/dev/tcp/localhost/${nodeServicePort}; printf "GET /health-check HTTP/1.1\\r\\nhost: http://localhost:${nodeServicePort}\\r\\nConnection: close\\r\\n\\r\\n" >&3; grep -q "200 OK" <&3 || exit 1`,
      ],
      interval: "30s",
      timeout: "30s",
      retries: 5,
      startPeriod: "120s",
    },
  };
}

interface MiningClientServiceOptions {
  image: string;
  onDemandMining?: boolean;
  constantDelayBlockTime?: number;
  miningClientPort?: number;
  nodeServicePort?: number;
}

export function createMiningClientService({
  image = MINING_CLIENT_IMAGE,
  onDemandMining = true,
  constantDelayBlockTime = 5,
  miningClientPort = MINING_CLIENT_PORT,
  nodeServicePort = NODE_SERVICE_PORT,
}: Partial<MiningClientServiceOptions> = {}): ContainerConfig {
  return {
    id: MINING_CLIENT_SERVICE_NAME,
    name: MINING_CLIENT_SERVICE_NAME,
    image: image.split(':')[0] || image,
    tag: image.split(':')[1] || 'latest',
    restart: "unless-stopped",
    dependencies: [BOOTSTRAP_NODE_SERVICE_NAME],
    command: [
      `--public-key=${MINER_PUBLIC_KEY}`,
      `--node=${BOOTSTRAP_NODE_SERVICE_NAME}:${nodeServicePort}`,
      onDemandMining ? "--worker=on-demand" : "--worker=constant-delay",
      onDemandMining ? `--on-demand-port=${miningClientPort}` : `--stratum-port=${miningClientPort}`,
      "--thread-count=1",
      "--log-level=info",
      "--no-tls",
      `--constant-delay-block-time=${constantDelayBlockTime}`,
    ],
    ports: [{ host: miningClientPort, container: miningClientPort }],
  };
}

interface MiningTriggerServiceOptions {
  miningClientUrl: string;
  chainwebServiceEndpoint: string;
  miningTriggerPort: number;
  miningConfig?: DevNetMiningConfig;
}

export function createMiningTriggerService({
  miningClientUrl = `http://${MINING_CLIENT_SERVICE_NAME}:${MINING_CLIENT_PORT}`,
  chainwebServiceEndpoint = `http://${BOOTSTRAP_NODE_SERVICE_NAME}:${NODE_SERVICE_PORT}`,
  miningTriggerPort = MINING_TRIGGER_PORT,
  miningConfig = {},
}: Partial<MiningTriggerServiceOptions> = {}): ContainerConfig {
  const {
    transactionBatchPeriod = 0.05,
    confirmationCount = 5,
    confirmationPeriod = 1,
    miningCooldown = 0.05,
    idlePeriod = 5,
    disableIdleWorker = false,
    disableConfirmationWorker = false,
  } = miningConfig;
  return {
    id: MINING_TRIGGER_SERVICE_NAME,
    name: MINING_TRIGGER_SERVICE_NAME,
    image: MINING_TRIGGER_IMAGE.split(':')[0] || MINING_TRIGGER_IMAGE,
    tag: MINING_TRIGGER_IMAGE.split(':')[1] || 'latest',
    entrypoint: ["/usr/local/bin/mining-trigger"],
    command: [
      `--port=${miningTriggerPort}`,
      `--mining-client-url=${miningClientUrl}`,
      `--chainweb-service-endpoint=${chainwebServiceEndpoint}`,
      `--idle-trigger-period=${idlePeriod}`,
      `--confirmation-trigger-period=${confirmationPeriod}`,
      `--transaction-batch-period=${transactionBatchPeriod}`,
      `--confirmation-count=${confirmationCount}`,
      `--mining-cooldown=${miningCooldown}`,
      disableIdleWorker ? "--disable-idle-worker" : undefined,
      disableConfirmationWorker ? "--disable-confirmation-worker" : undefined,
      "--dev-request-logger",
    ].filter(Boolean) as string[],
    dependencies: [BOOTSTRAP_NODE_SERVICE_NAME, MINING_CLIENT_SERVICE_NAME],
    restart: "unless-stopped",
    ports: [{ host: miningTriggerPort, container: miningTriggerPort }],
  };
}

interface ApiProxyServiceOptions {
  image: string;
  port: number;
}

export function createApiProxyService({
  image = "nginx:alpine",
  port = DEVNET_PUBLIC_PORT,
}: Partial<ApiProxyServiceOptions> = {}): ContainerConfig {
  return {
    id: API_PROXY_SERVICE_NAME,
    name: API_PROXY_SERVICE_NAME,
    image: image.split(':')[0] || image,
    tag: image.split(':')[1] || 'latest',
    labels: {
      "com.chainweb.devnet.description": "Devnet API Proxy",
      "com.chainweb.devnet.api-proxy": "",
    },
    dependencies: [BOOTSTRAP_NODE_SERVICE_NAME, MINING_CLIENT_SERVICE_NAME, MINING_TRIGGER_SERVICE_NAME],
    volumes: [
      { host: `${DEVNET_CONFIGS_DIR}/nginx.api.minimal.conf`, container: "/etc/nginx/conf.d/default.conf", mode: "ro" }
    ],
    ports: [
      {
        host: port,
        container: 80,
        protocol: "tcp",
      },
    ],
  };
}

interface MinimalDevNetOptions {
  clusterId: string;
  port: number;
  networkName: string;
  persistDb?: boolean;
  miningConfig?: DevNetMiningConfig;
}

export function createMinimalDevNet({
  clusterId = MINIMAL_CLUSTER_ID,
  port = DEVNET_PUBLIC_PORT,
  networkName = MINIMAL_NETWORK_NAME,
  persistDb = true,
}: Partial<MinimalDevNetOptions> = {}): DevNetServiceDefinition {
  const volume = `devnet_db_${clusterId.replace("-", "_")}`;
  return {
    clusterId,
    networkName,
    volumes: persistDb ? [volume] : [],
    services: {
      bootstrapNode: createChainwebNodeService({
        clusterId,
        persistDb,
        volume,
      }),
      miningClient: createMiningClientService(),
      miningTrigger: createMiningTriggerService(),
      apiProxy: createApiProxyService({
        port,
      }),
    },
  };
}
