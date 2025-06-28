import type { DockerServiceConfig } from "@pact-toolbox/docker";
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
}: Partial<ChainwebNodeServiceOptions>): DockerServiceConfig {
  return {
    image,
    containerName: BOOTSTRAP_NODE_SERVICE_NAME,
    labels: {
      "com.chainweb.devnet.description": "Devnet Bootstrap Node",
      "com.chainweb.devnet.node": "",
      "com.chainweb.devnet.bootstrap-node": "",
    },
    restart: "unless-stopped",
    stopSignal: "SIGINT",
    stopGracePeriod: 20,
    ulimits: [{ Name: "nofile", Soft: 65535, Hard: 65535 }],
    volumes: [
      persistDb && volume ? `${volume}:/chainweb/db` : undefined,
      `${DEVNET_CONFIGS_DIR}/devnet-bootstrap-node.cert.pem:/chainweb/devnet-bootstrap-node.cert.pem:ro`,
      `${DEVNET_CONFIGS_DIR}/devnet-bootstrap-node.key.pem:/chainweb/devnet-bootstrap-node.key.pem:ro`,
      `${DEVNET_CONFIGS_DIR}/chainweb-node.common.yaml:/chainweb/config/chainweb-node.common.yaml:ro`,
      `${DEVNET_CONFIGS_DIR}/chainweb-node.logging.yaml:/chainweb/config/chainweb-node.logging.yaml:ro`,
    ].filter(Boolean) as string[],
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
    expose: [`${nodeServicePort}`, `${p2pPort}`],
    environment: ["DISABLE_POW_VALIDATION=true"],
    healthCheck: {
      Test: [
        "CMD",
        "/bin/bash",
        "-c",
        `exec 3<>/dev/tcp/localhost/${nodeServicePort}; printf "GET /health-check HTTP/1.1\\r\\nhost: http://localhost:${nodeServicePort}\\r\\nConnection: close\\r\\n\\r\\n" >&3; grep -q "200 OK" <&3 || exit 1`,
      ],
      Interval: 30e9,
      Timeout: 30e9,
      Retries: 5,
      StartPeriod: 120e9,
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
}: Partial<MiningClientServiceOptions> = {}): DockerServiceConfig {
  return {
    containerName: MINING_CLIENT_SERVICE_NAME,
    image,
    restart: "unless-stopped",
    dependsOn: {
      [BOOTSTRAP_NODE_SERVICE_NAME]: { condition: "service_healthy" },
    },
    // entrypoint: ["/app/chainweb-mining-client"],
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
    // healthCheck: {
    //   Test: ["CMD", "/bin/bash", "-c", `curl http://localhost:${miningClientPort}/make-blocks -d '{}'`],
    //   Interval: 30e9,
    //   Timeout: 30e9,
    //   Retries: 5,
    //   StartPeriod: 120e9,
    // },

    expose: [`${miningClientPort}`],
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
}: Partial<MiningTriggerServiceOptions> = {}): DockerServiceConfig {
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
    containerName: MINING_TRIGGER_SERVICE_NAME,
    image: MINING_TRIGGER_IMAGE,
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
    dependsOn: {
      [BOOTSTRAP_NODE_SERVICE_NAME]: { condition: "service_healthy" },
      [MINING_CLIENT_SERVICE_NAME]: { condition: "service_healthy" },
    },
    restart: "unless-stopped",
    expose: [`${miningTriggerPort}`],
  };
}

interface ApiProxyServiceOptions {
  image: string;
  port: number;
}

export function createApiProxyService({
  image = "nginx:alpine",
  port = DEVNET_PUBLIC_PORT,
}: Partial<ApiProxyServiceOptions> = {}): DockerServiceConfig {
  return {
    containerName: API_PROXY_SERVICE_NAME,
    image,
    labels: {
      "com.chainweb.devnet.description": "Devnet API Proxy",
      "com.chainweb.devnet.api-proxy": "",
    },
    dependsOn: {
      [BOOTSTRAP_NODE_SERVICE_NAME]: { condition: "service_healthy" },
      [MINING_CLIENT_SERVICE_NAME]: { condition: "service_healthy" },
      [MINING_TRIGGER_SERVICE_NAME]: { condition: "service_healthy" },
    },
    volumes: [`${DEVNET_CONFIGS_DIR}/nginx.api.minimal.conf:/etc/nginx/conf.d/default.conf:ro`],
    ports: [
      {
        target: 80,
        published: port,
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
  // Generate unique volume name with timestamp to ensure isolation in stateless mode
  const volume = persistDb ? `devnet_db_${clusterId.replace("-", "_")}` : `devnet_db_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  return {
    clusterId,
    networkName,
    volumes: persistDb ? [volume] : [],
    services: {
      bootstrapNode: createChainwebNodeService({
        clusterId,
        persistDb,
        volume: persistDb ? volume : undefined,
      }),
      miningClient: createMiningClientService(),
      miningTrigger: createMiningTriggerService(),
      apiProxy: createApiProxyService({
        port,
      }),
    },
  };
}
