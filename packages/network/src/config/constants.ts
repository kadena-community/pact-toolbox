import path from "path";

export const CWD: string = process.cwd();
export const MINER_PUBLIC_KEY: string =
  process.env.MINER_PUBLIC_KEY || "f89ef46927f506c70b6a58fd322450a936311dc6ac91f4ec3d8ef949608dbf1f";
export const MINING_CLIENT_IMAGE: string =
  process.env.MINING_CLIENT_IMAGE || "ghcr.io/kadena-io/chainweb-mining-client:latest";
export const DEVNET_PROXY_PORT: number = process.env.DEVNET_PROXY_PORT ? Number(process.env.DEVNET_PROXY_PORT) : 8080;
export const CHAINWEB_NODE_IMAGE: string =
  process.env.CHAINWEB_NODE_IMAGE || "ghcr.io/kadena-io/chainweb-node/ubuntu:latest";
export const MINING_TRIGGER_IMAGE: string =
  process.env.MINING_TRIGGER_IMAGE || "salamaashoush/mining-trigger-rs:latest";
export const DEVNET_CONFIGS_DIR: string = path.resolve(CWD, ".pact-toolbox", "configs");
export const CHAINWEB_DB_DIR: string = path.resolve(CWD, ".pact-toolbox", "chainweb", "db");
export const MINIMAL_NETWORK_NAME: string = "devnet-minimal-network";
export const MINIMAL_CLUSTER_ID: string = "devnet-minimal";
export const DEFAULT_NETWORK_NAME: string = "devnet_default_network";
export const NGINX_API_MINIMAL_CONF_NAME: string = "nginx.api.minimal.conf";
export const SERVICES_CONFIG_FILE: string = path.join(process.cwd(), "config", "services.json");
export const NODE_SERVICE_PORT: number = 1848;
export const P2P_PORT: number = 1789;
export const MINING_CLIENT_PORT: number = 1917;
export const MINING_TRIGGER_PORT: number = 1791;
export const MINING_CLIENT_SERVICE_NAME = "mining-client";
export const MINING_TRIGGER_SERVICE_NAME = "mining-trigger";
export const BOOTSTRAP_NODE_SERVICE_NAME = "bootstrap-node";
export const API_PROXY_SERVICE_NAME = "api-proxy";
