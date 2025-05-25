import Docker from "dockerode"; // Import Docker
import {
  CHAINWEB_NODE_IMAGE,
  DEVNET_CONFIGS_DIR,
  HOST_SERVICE_PORT,
  MINER_PUBLIC_KEY,
  MINING_CLIENT_IMAGE,
  P2P_PORT,
} from "../config/constants";
import { DevNetServiceDefinition, DockerServiceConfig } from "../types";

const FULL_DEVNET_NETWORK_NAME = process.env.NETWORK_NAME || "kadena_devnet_full"; // Or derive from docker-compose if specified
const FULL_DEVNET_CLUSTER_ID = process.env.CLUSTER_ID || "kadena-full";

// TODO: Define default environment variables used in docker-compose.yaml if not from constants
const DEFAULT_HOST_SERVICE_PORT = process.env.HOST_SERVICE_PORT || "8080";
const DEFAULT_HOST_STRATUM_PORT = process.env.HOST_STRATUM_PORT || "1917";
const DEFAULT_MINER_PUBLIC_KEY =
  process.env.MINER_PUBLIC_KEY ||
  MINER_PUBLIC_KEY ||
  "f89ef46927f506c70b6a58fd322450a936311dc6ac91f4ec3d8ef949608dbf1f";
const DEFAULT_COMMON_NODE_REPLICAS = parseInt(process.env.COMMON_NODE_REPLICAS || "1", 10);
const DEFAULT_MINING_NODE_REPLICAS = parseInt(process.env.MINING_NODE_REPLICAS || "0", 10);
const DEFAULT_API_NODE_REPLICAS = parseInt(process.env.API_NODE_REPLICAS || "1", 10);

const CHAINWEB_NODE_COMMON_YAML = "chainweb-node.common.yaml";
const CHAINWEB_NODE_LOGGING_YAML = "chainweb-node.logging.yaml";
const CHAINWEB_NODE_ELASTIC_YAML = "chainweb-node.elastic.yaml";

// Deep merge helper for nested objects and arrays
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const output = { ...target } as T;
  if (target && source) {
    Object.keys(source).forEach((key) => {
      const targetValue = target[key as keyof T];
      const sourceValue = source[key as keyof T];
      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        // Ensure unique items for simple arrays, concatenate for arrays of objects or complex items
        if (sourceValue.every((item) => typeof item === "string" || typeof item === "number")) {
          (output[key as keyof T] as any) = Array.from(new Set([...targetValue, ...sourceValue]));
        } else {
          (output[key as keyof T] as any) = [...targetValue, ...sourceValue];
        }
      } else if (
        typeof targetValue === "object" &&
        targetValue !== null &&
        typeof sourceValue === "object" &&
        sourceValue !== null &&
        !Array.isArray(targetValue) &&
        !Array.isArray(sourceValue)
      ) {
        (output[key as keyof T] as any) = deepMerge(targetValue as object, sourceValue as object);
      } else {
        (output[key as keyof T] as any) = sourceValue;
      }
    });
  }
  return output;
}

// Helper to merge an "extends" base with an overriding service config
// This is a simplified version; a deep merge might be needed for some fields.
function applyExtends(base: DockerServiceConfig, extend: Partial<DockerServiceConfig>): DockerServiceConfig {
  return deepMerge(base, extend);
}

// --- Base Service Definitions (from node.yaml, node-l2.yaml) ---

interface BaseNodeOptions {
  containerName: string; // Made mandatory here
  image?: string;
  clusterId?: string; // Will be part of command, not directly DockerServiceConfig
  p2pPort?: string | number;
  servicePort?: string | number;
  isL2?: boolean;
  additionalCommandArgs?: string[];
  additionalVolumes?: string[];
  additionalEnv?: string[] | { [key: string]: string };
  disablePowValidation?: boolean;
  labels?: { [key: string]: string };
  dependsOn?: { [key: string]: { condition: string } };
  healthCheckOverride?: Partial<Docker.HealthConfig>; // Allow partial override of healthcheck
  loggingConfigName?: string;
  deployOverrides?: Partial<DockerServiceConfig["deploy"]>;
}

function createBaseNodeService(options: BaseNodeOptions): DockerServiceConfig {
  const {
    containerName,
    image = CHAINWEB_NODE_IMAGE,
    p2pPort = options.isL2 ? 1790 : P2P_PORT,
    servicePort = options.isL2 ? 1849 : HOST_SERVICE_PORT,
    isL2 = false,
    additionalCommandArgs = [],
    additionalVolumes = [],
    additionalEnv = [],
    disablePowValidation = true,
    labels = {},
    dependsOn = {},
    healthCheckOverride = {},
    loggingConfigName = CHAINWEB_NODE_LOGGING_YAML,
    deployOverrides = {},
  } = options;

  const commonConfigFileName = isL2 ? "chainweb-node.common-l2.yaml" : CHAINWEB_NODE_COMMON_YAML;
  const healthCheckPortToUse = servicePort;

  let envArray: string[] = [];
  if (disablePowValidation) {
    envArray.push("DISABLE_POW_VALIDATION=true");
  }

  if (Array.isArray(additionalEnv)) {
    envArray = [...envArray, ...additionalEnv];
  } else {
    // additionalEnv is object
    for (const [key, value] of Object.entries(additionalEnv)) {
      envArray.push(`${key}=${value}`);
    }
  }
  const finalEnv = envArray.length > 0 ? envArray : undefined;

  const baseDeploySettings: DockerServiceConfig["deploy"] = {
    restartPolicy: {
      condition: "on-failure",
      delay: "5s",
      maxAttempts: 3,
      window: "120s",
    },
  };

  const baseService: DockerServiceConfig = {
    containerName,
    image,
    platform: "linux/amd64",
    restart: "unless-stopped",
    stopSignal: "SIGINT",
    stopGracePeriod: 20,
    ulimits: [{ Name: "nofile", Soft: 65535, Hard: 65535 }],
    expose: [String(p2pPort), String(servicePort)],
    volumes: [
      `${DEVNET_CONFIGS_DIR}/${commonConfigFileName}:/chainweb/config/${commonConfigFileName}:ro`,
      `${DEVNET_CONFIGS_DIR}/${loggingConfigName}:/chainweb/config/${loggingConfigName}:ro`,
      ...additionalVolumes,
    ],
    entrypoint: [
      "/chainweb/chainweb-node",
      "+RTS",
      "-T",
      "-H400M",
      "-A64M",
      "-RTS",
      `--config-file=config/${commonConfigFileName}`,
      `--config-file=config/${loggingConfigName}`,
    ],
    command: additionalCommandArgs,
    environment: finalEnv,
    labels: {
      "com.chainweb.devnet.description": isL2 ? "Devnet L2 Node" : "Devnet Node",
      "com.chainweb.devnet.node": "",
      ...labels,
    },
    dependsOn,
    healthCheck: deepMerge(
      {
        Test: [
          "CMD",
          "/bin/bash",
          "-c",
          `exec 3<>/dev/tcp/localhost/${healthCheckPortToUse}; printf "GET /health-check HTTP/1.1\\r\\nhost: http://localhost:${healthCheckPortToUse}\\r\\nConnection: close\\r\\n\\r\\n" >&3; grep -q "200 OK" <&3 || exit 1`,
        ],
        Interval: 30 * 1_000_000_000, // 30s in nanoseconds for Dockerode
        Timeout: 30 * 1_000_000_000, // 30s
        Retries: 5,
        StartPeriod: 120 * 1_000_000_000, // 2m
      },
      healthCheckOverride,
    ),
    deploy: deepMerge(baseDeploySettings, deployOverrides),
  };
  return baseService;
}

// --- Service-Specific Factories ---
// We will create these based on docker-compose.yaml and elasticsearch.yaml
// Example: createBootstrapNodeService, createCommonNodeService, createElasticsearchService, etc.

// --- Main Preset Function ---

interface FullDevNetOptions {
  // Define any options that might customize the full devnet
  // For example, versions of images if not taken from constants,
  // replica counts if not hardcoded or from defaults.
  commonNodeReplicas?: number;
  miningNodeReplicas?: number;
  apiNodeReplicas?: number;
  useElasticLogging?: boolean;
}

export function createFullDevNet(options: FullDevNetOptions = {}): DevNetServiceDefinition {
  const services: { [key: string]: DockerServiceConfig } = {};
  const loggingConfigForNodes = options.useElasticLogging ? CHAINWEB_NODE_ELASTIC_YAML : CHAINWEB_NODE_LOGGING_YAML;

  // Bootstrap Node
  services["bootstrapNode"] = createBootstrapNodeService(loggingConfigForNodes);

  // Common Node(s)
  const commonNodeReplicas =
    options.commonNodeReplicas !== undefined ? options.commonNodeReplicas : DEFAULT_COMMON_NODE_REPLICAS;
  if (commonNodeReplicas > 0) {
    // The service key in the map will be "common-node".
    // The ContainerOrchestrator will handle instance naming (e.g., common-node-1, common-node-2)
    // based on the `replicas` field in this config.
    services["common-node"] = {
      ...createCommonNodeService(loggingConfigForNodes),
      deploy: { replicas: commonNodeReplicas },
    };
    // If commonNodeReplicas is 1, it will create common-node-1 due to orchestrator naming.
    // If we want literally 'common-node' for a single replica, the orchestrator naming logic needs a slight tweak.
    // For now, this is consistent: common-node-1 for a single, common-node-1, common-node-2 for two.
    // The original `createCommonNodeService(instanceNumber)` created `common-node-${instanceNumber}`.
    // We need to ensure the `containerName` in the config given to orchestrator is the *base* name.
    // The factory `createCommonNodeService` might need adjustment to not include instanceNumber in its default containerName.
  }

  // API Node(s)
  const apiNodeReplicas = options.apiNodeReplicas !== undefined ? options.apiNodeReplicas : DEFAULT_API_NODE_REPLICAS;
  if (apiNodeReplicas > 0) {
    services["api-node"] = {
      ...createApiNodeService(loggingConfigForNodes),
      deploy: { replicas: apiNodeReplicas },
    };
  }

  // Mining API Node (mining-api-node)
  // This service extends node.yaml
  const miningApiNodeBase = createBaseNodeService({
    containerName: "mining-api-node", // This will be the group name, orchestrator appends replica number if any
    labels: {
      "com.docker.lb.ip_hash": "true", // from compose
      "com.chainweb.devnet.description": "Devnet Mining API Node",
      "com.chainweb.devnet.mining-api-node": "",
    },
    dependsOn: { "bootstrap-node": { condition: "service_healthy" } },
    additionalCommandArgs: [
      `--known-peer-info=YNo7pXthYQ9RQKv1bbpQf2R5LcLYA3ppx2BL2Hf8fIM@bootstrap-node:${P2P_PORT}`,
      "--bootstrap-reachability=1",
      "--p2p-hostname=0.0.0.0",
      "--cluster-id=stratum-node", // from compose
      "--enable-mining-coordination",
      `--mining-public-key=${DEFAULT_MINER_PUBLIC_KEY}`,
    ],
    // environment: DISABLE_POW_VALIDATION is default in createBaseNodeService
  });
  services["mining-api-node"] = miningApiNodeBase;
  // If mining-api-node could have replicas, add deploy: {replicas: N}

  // Stratum Server (stratum-server)
  services["stratum-server"] = {
    containerName: "stratum-server",
    image: MINING_CLIENT_IMAGE, // Uses ${MINING_CLIENT_IMAGE}
    platform: "linux/amd64", // Added for consistency, not in compose but good practice
    restart: "unless-stopped",
    dependsOn: { "mining-api-node": { condition: "service_healthy" } },
    entrypoint: "/chainweb-mining-client/chainweb-mining-client",
    command: [
      `--public-key=${DEFAULT_MINER_PUBLIC_KEY}`,
      "--node=mining-api-node:1848", // Assumes mining-api-node default service port
      "--worker=stratum",
      "--thread-count=2",
      "--no-tls",
    ],
    ports: [
      {
        target: 1917,
        published: DEFAULT_HOST_STRATUM_PORT, // from compose ${HOST_STRATUM_PORT}
        protocol: "tcp",
      },
    ],
    profiles: ["stratum"], // from compose
  };

  // Simulation Miner (simulation-miner)
  services["simulation-miner"] = {
    containerName: "simulation-miner",
    image: MINING_CLIENT_IMAGE, // Uses ${MINING_CLIENT_IMAGE}
    platform: "linux/amd64",
    restart: "unless-stopped",
    dependsOn: { "mining-api-node": { condition: "service_healthy" } },
    entrypoint: "/chainweb-mining-client/chainweb-mining-client",
    command: [
      `--public-key=${DEFAULT_MINER_PUBLIC_KEY}`,
      "--node=mining-api-node:1848",
      "--worker=simulation",
      "--thread-count=2",
      "--no-tls",
      "--hash-rate=1000000", // from compose
    ],
  };

  // Nginx API Proxy (api-proxy)
  services["api-proxy"] = {
    containerName: "api-proxy",
    image: "nginx:alpine", // from compose
    platform: "linux/amd64",
    labels: {
      "com.chainweb.devnet.description": "Devnet API Proxy",
      "com.chainweb.devnet.api-proxy": "",
    },
    dependsOn: { "api-node": { condition: "service_healthy" } }, // Assumes api-node is the group name for potentially replicated api nodes
    volumes: [
      // PWD in compose is the root. DEVNET_CONFIGS_DIR is dockerode-runner/devnet-configs
      // So, `${process.cwd()}/config/nginx.api.conf` if script run from root
      // Or, better, ensure nginx.api.conf is generated into DEVNET_CONFIGS_DIR by DevNetManager
      // And use: `${DEVNET_CONFIGS_DIR}/nginx.api.conf:/etc/nginx/conf.d/default.conf:ro`
      // For now, I'll use the latter, assuming DevNetManager handles placing nginx.api.conf.
      // The minimal preset uses nginx.api.minimal.conf. The full one might need a different one.
      // The `config/nginx.api.conf` from compose needs to be available.
      // Let's assume it will be generated to `${DEVNET_CONFIGS_DIR}/nginx.api.full.conf`
      `${DEVNET_CONFIGS_DIR}/nginx.api.full.conf:/etc/nginx/conf.d/default.conf:ro`,
    ],
    ports: [
      {
        target: 80,
        published: DEFAULT_HOST_SERVICE_PORT, // from compose ${HOST_SERVICE_PORT}
        protocol: "tcp",
      },
    ],
  };

  // --- Services from elasticsearch.yaml ---
  // These often modify existing services or add new ones for logging.
  // For simplicity now, I'm adding them directly. A profile might be better.

  const elasticImage = "docker.elastic.co/elasticsearch/elasticsearch:8.4.2";
  const kibanaImage = "docker.elastic.co/kibana/kibana:8.4.2";
  const metricbeatImage = "docker.elastic.co/beats/metricbeat:8.4.2";
  const filebeatImage = "docker.elastic.co/beats/filebeat:8.4.2";
  const curlImage = "curlimages/curl:latest";

  services["elasticsearch"] = {
    containerName: "elasticsearch",
    image: elasticImage,
    platform: "linux/amd64",
    environment: [
      "xpack.security.enabled=false",
      "xpack.security.http.ssl.enabled=false",
      "xpack.security.transport.ssl.enabled=false",
      "discovery.type=single-node",
      "bootstrap.memory_lock=true",
      "ES_JAVA_OPTS=-Xms512m -Xmx512m",
    ],
    // mem_limit is not directly translatable to Dockerode createOptions in the same way.
    // It's usually part of HostConfig.Memory. For now, omitting.
    ulimits: [
      { Name: "memlock", Soft: -1, Hard: -1 },
      { Name: "nofile", Soft: 65536, Hard: 65536 },
    ],
    // cap_add: ["IPC_LOCK"] // Also part of HostConfig, can be added if necessary
    healthCheck: {
      Test: ["CMD-SHELL", "curl --fail -s http://elasticsearch:9200"], // CMD-SHELL for direct command
      Interval: 5 * 1_000_000_000,
      Timeout: 5 * 1_000_000_000,
      Retries: 120,
    },
    profiles: ["logging"], // Added a profile for these
  };

  services["kibana"] = {
    containerName: "kibana",
    image: kibanaImage,
    platform: "linux/amd64",
    dependsOn: { elasticsearch: { condition: "service_healthy" } },
    ports: [{ target: 5601, published: "5601", protocol: "tcp" }],
    environment: {
      ELASTICSEARCH_URL: "http://elasticsearch:9200",
      ELASTICSEARCH_HOSTS: "http://elasticsearch:9200",
      KIBANA_FLEET_SETUP: "false",
    },
    healthCheck: {
      Test: ["CMD-SHELL", "curl --fail -s http://kibana:5601/api/status"],
      Interval: 5 * 1_000_000_000,
      Timeout: 5 * 1_000_000_000,
      Retries: 120,
    },
    profiles: ["logging"],
  };

  // kibana-objects, metricbeat, filebeat are more complex due to volumes and commands.
  // For now, focusing on getting the structure right for the main services.

  // Modify existing services based on elasticsearch.yaml (e.g., add depends_on elasticsearch)
  const servicesToUpdateForElastic = ["bootstrap-node", "common-node", "mining-node", "mining-api-node", "api-node"];
  if (services["elasticsearch"]) {
    // Only if elasticsearch itself is defined
    for (const serviceName of servicesToUpdateForElastic) {
      if (services[serviceName]) {
        services[serviceName].dependsOn = {
          ...services[serviceName].dependsOn,
          elasticsearch: { condition: "service_healthy" },
        };
        // elasticsearch.yaml also implies changing the logging config file for nodes.
        // This is complex as it changes the file mounted in volumes for base nodes.
        // createBaseNodeService would need a parameter for loggingConfigName.
        // For now, this aspect is skipped but noted.
      }
    }
    if (services["api-proxy"]) {
      services["api-proxy"].labels = {
        ...services["api-proxy"].labels,
        "co.elastic.metrics/module": "nginx",
        "co.elastic.metrics/metricsets": "stubstatus",
        "co.elastic.metrics/hosts": "nginx:80", // Assuming api-proxy internal name is nginx on port 80
        "co.elastic.metrics/period": "10s",
      };
    }
  }

  return {
    networkName: FULL_DEVNET_NETWORK_NAME,
    clusterId: FULL_DEVNET_CLUSTER_ID,
    services,
  } as DevNetServiceDefinition;
}
