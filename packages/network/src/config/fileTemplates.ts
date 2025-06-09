import {
  BOOTSTRAP_NODE_SERVICE_NAME,
  DEVNET_PROXY_PORT,
  MINING_CLIENT_PORT,
  MINING_CLIENT_SERVICE_NAME,
  MINING_TRIGGER_PORT,
  MINING_TRIGGER_SERVICE_NAME,
  NODE_SERVICE_PORT,
  P2P_PORT,
} from "./constants";

export const CHAINWEB_NODE_COMMON_YAML_CONTENT_TPL = `
chainweb:
  chainwebVersion: development
  throttling:
    global: 50
    mempool: 20
    putPeer: 11
  serviceApi:
    interface: '*'
    port: 1848
  p2p:
    peer:
      hostaddress:
        port: 1789
    ignoreBootstrapNodes: true
    maxSessionCount: 2
  mempoolP2p:
    configuration:
      maxSessionCount: 2
`;

export const CHAINWEB_NODE_LOGGING_YAML_CONTENT_TPL = `
logging:
  logger:
    log_level: warn
  backend:
    format: json
  telemetryBackend:
    configuration:
      format: json
`;

interface NginxApiConfigContentOptions {
  chainwebServiceName: string;
  miningClientServiceName: string;
  miningClientPort: number;
  serviceApiPort: number;
  p2pPort: number;
  miningTriggerServiceName: string;
  miningTriggerPort: number;
  enableMiningTrigger: boolean;
}

export function createNginxApiConfigContent({
  chainwebServiceName = BOOTSTRAP_NODE_SERVICE_NAME,
  miningClientServiceName = MINING_CLIENT_SERVICE_NAME,
  miningTriggerServiceName = MINING_TRIGGER_SERVICE_NAME,
  miningClientPort = MINING_CLIENT_PORT,
  miningTriggerPort = MINING_TRIGGER_PORT,
  serviceApiPort = NODE_SERVICE_PORT,
  p2pPort = P2P_PORT,
  enableMiningTrigger = false,
}: Partial<NginxApiConfigContentOptions> = {}) {
  return `
# Service API endpoints
upstream service-api {
    server ${chainwebServiceName}:${serviceApiPort};
}
upstream mining-api {
    ip_hash;
    server ${chainwebServiceName}:${serviceApiPort};
}
upstream peer-api {
    server ${chainwebServiceName}:${p2pPort};
}
upstream mining-client-api {
    server ${miningClientServiceName}:${miningClientPort};
}
${
  enableMiningTrigger
    ? `upstream mining-trigger-api {
    server ${miningTriggerServiceName}:${miningTriggerPort};
}`
    : ""
}
server {
    server_name api.devnet.chainweb.com
    listen 80;

    access_log /var/log/nginx/chainweb-api-access.log;
    error_log /var/log/nginx/chainweb-api-error.log;

    # Service API endpoints
    location = /info {
        proxy_pass http://service-api;
    }
    location = /health-check {
        proxy_pass http://service-api;
    }

    ${
      enableMiningTrigger
        ? `# Mining Trigger Proxy
    location ~ ^/chainweb/0.0/[0-9a-zA-Z-_]+/chain/[0-9]+/pact/api/v1/send {
        proxy_pass http://mining-trigger-api;
    }`
        : ""
    }

    location ~ ^/chainweb/0.0/[0-9a-zA-Z-_]+/chain/[0-9]+/pact/ {
        proxy_pass http://service-api;
    }
    location ~ ^/chainweb/0.0/[0-9a-zA-Z-_]+/chain/[0-9]+/block {
        proxy_pass http://service-api;
    }
    location ~ ^/chainweb/0.0/[0-9a-zA-Z-_]+/chain/[0-9]+/(header|hash|branch|payload) {
        proxy_pass http://service-api;
    }
    location ~ ^/chainweb/0.0/[0-9a-zA-Z-_]+/cut {
        proxy_pass http://service-api;
    }

    # Optional Service APIs
    location ~ ^/chainweb/0.0/[0-9a-zA-Z-_]+/header/updates {
        proxy_buffering off;
        proxy_pass http://service-api;
    }

    # Mining
    location /chainweb/0.0/[0-9a-zA-Z-_]+/mining/ {
        proxy_buffering off;
        proxy_pass http://mining-api;
    }

    # Mempool
    location ~ ^/chainweb/0.0/[0-9a-zA-Z-_]+/chain/[0-9]+/mempool/(getPending|member|lookup|insert) {
        proxy_pass https://peer-api;
        proxy_ssl_verify off;
    }

    # Config (P2P API)
    location = /config {
        proxy_pass https://peer-api;
        # needed if self signed certificates are used for nodes:
        proxy_ssl_verify off;
    }

    # Mining Client API
    location = /make-blocks {
        proxy_pass http://mining-client-api/make-blocks;
        proxy_buffering off;
        proxy_ssl_verify off;
    }

    # Default
    location / {
        return 404;
    }
}`;
}
