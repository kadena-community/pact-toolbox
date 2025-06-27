import { ContainerOrchestrator } from "../src/orchestrator";
import type { ContainerConfig } from "../src/types";

/**
 * Example of using the Docker package to run a DevNet-like service configuration
 */
async function runDevNet() {
  // Create orchestrator instance
  const orchestrator = new ContainerOrchestrator({
    defaultNetwork: "devnet-network",
    enableMetrics: true,
    healthCheckDefaults: {
      interval: "30s",
      timeout: "30s",
      retries: 3,
    },
  });

  // Define services similar to minimal.ts
  const devnetServices: Record<string, ContainerConfig> = {
    bootstrapNode: {
      id: "bootstrap-node",
      name: "devnet-bootstrap-node",
      image: "ghcr.io/kadena-io/chainweb-node",
      tag: "latest",
      restart: "unless-stopped",
      volumes: [
        { host: "devnet_db", container: "/chainweb/db", mode: "rw" },
        { host: "./configs/cert.pem", container: "/chainweb/cert.pem", mode: "ro" },
        { host: "./configs/key.pem", container: "/chainweb/key.pem", mode: "ro" },
        { host: "./configs/chainweb-node.common.yaml", container: "/chainweb/config/chainweb-node.common.yaml", mode: "ro" },
      ],
      entrypoint: ["/chainweb/chainweb-node"],
      command: [
        "--p2p-certificate-chain-file=/chainweb/cert.pem",
        "--p2p-certificate-key-file=/chainweb/key.pem",
        "--p2p-hostname=bootstrap-node",
        "--bootstrap-reachability=1",
        "--cluster-id=devnet-minimal",
        "--p2p-max-session-count=2",
        "--enable-mining-coordination",
        "--mining-public-key=f318e4f3d05d38bb3ceaac26f86db7124a1700f3288c0c0bab8257b002eb2caa",
        "--header-stream",
        "--allowReadsInLocal",
        "--database-directory=/chainweb/db",
        "--disable-pow",
      ],
      env: {
        DISABLE_POW_VALIDATION: "true",
      },
      healthCheck: {
        test: ["CMD", "/bin/bash", "-c", "curl -f http://localhost:1848/health-check || exit 1"],
        interval: "30s",
        timeout: "30s",
        retries: 5,
        startPeriod: "120s",
      },
      labels: {
        "com.chainweb.devnet.description": "Devnet Bootstrap Node",
        "com.chainweb.devnet.node": "",
        "com.chainweb.devnet.bootstrap-node": "",
      },
    },

    miningClient: {
      id: "mining-client",
      name: "devnet-mining-client",
      image: "ghcr.io/kadena-io/chainweb-mining-client",
      tag: "latest",
      restart: "unless-stopped",
      dependencies: ["bootstrap-node"],
      command: [
        "--public-key=f318e4f3d05d38bb3ceaac26f86db7124a1700f3288c0c0bab8257b002eb2caa",
        "--node=bootstrap-node:1848",
        "--worker=on-demand",
        "--on-demand-port=8080",
        "--thread-count=1",
        "--log-level=info",
        "--no-tls",
        "--constant-delay-block-time=5",
      ],
      ports: [{ host: 8080, container: 8080 }],
    },

    apiProxy: {
      id: "api-proxy",
      name: "devnet-api-proxy",
      image: "nginx",
      tag: "alpine",
      restart: "unless-stopped",
      dependencies: ["bootstrap-node", "mining-client"],
      volumes: [
        { host: "./configs/nginx.conf", container: "/etc/nginx/conf.d/default.conf", mode: "ro" },
      ],
      ports: [{ host: 8081, container: 80 }],
      labels: {
        "com.chainweb.devnet.description": "Devnet API Proxy",
        "com.chainweb.devnet.api-proxy": "",
      },
    },
  };

  // Set up event listeners
  orchestrator.on("started", (id, _state) => {
    console.log(`✅ Container ${id} started successfully`);
  });

  orchestrator.on("failed", (id, error, _state) => {
    console.error(`❌ Container ${id} failed to start:`, error.message);
  });

  orchestrator.on("healthy", (id, _state) => {
    console.log(`💚 Container ${id} is healthy`);
  });

  orchestrator.on("unhealthy", (id, _state) => {
    console.log(`💔 Container ${id} is unhealthy`);
  });

  // Stream logs from containers
  orchestrator.s("bootstrap-node", (id, log) => {
    console.log(`[${id}] ${log}`);
  });

  try {
    console.log("🚀 Starting DevNet services...");
    
    // Start all services
    await orchestrator.startServices(devnetServices, "devnet-network");
    
    console.log("✨ All services started successfully!");
    
    // Wait for bootstrap node to be healthy
    console.log("⏳ Waiting for bootstrap node to be healthy...");
    await orchestrator.waitForHealthy("bootstrap-node", 180000); // 3 minutes timeout
    
    console.log("🎉 DevNet is ready!");
    console.log("📡 API endpoint: http://localhost:8081");
    console.log("⛏️  Mining endpoint: http://localhost:8080");
    
    // Keep running until interrupted
    process.on("SIGINT", async () => {
      console.log("\n🛑 Stopping DevNet services...");
      await orchestrator.stopAll();
      console.log("👋 DevNet stopped. Goodbye!");
      process.exit(0);
    });
    
  } catch (error) {
    console.error("Failed to start DevNet:", error);
    await orchestrator.stopAll(true); // Force stop on error
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  runDevNet().catch(console.error);
}