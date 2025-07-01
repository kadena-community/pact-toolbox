import { ContainerOrchestrator } from "../src/orchestrator";
import type { DockerServiceConfig } from "../src/types";

/**
 * Basic example showing how to run a single container
 */
async function runBasicExample() {
  const orchestrator = new ContainerOrchestrator({
    networkName: "test-network",
  });

  const service: DockerServiceConfig = {
    containerName: "test-nginx",
    image: "nginx:alpine",
    ports: [{ target: 80, published: 8080 }],
    healthCheck: {
      Test: ["CMD", "wget", "--quiet", "--spider", "http://localhost/"],
      Interval: 5000000000,
      Timeout: 3000000000,
      Retries: 3,
    },
  };

  try {
    console.log("Starting nginx container...");
    await orchestrator.startServices([service]);
    console.log("✓ Container started at http://localhost:8080");

    // Test health check
    const healthy = await orchestrator.isServiceHealthy("test-nginx");
    console.log(`✓ Health check: ${healthy ? "healthy" : "unhealthy"}`);

    // Keep running for 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log("Stopping container...");
    await orchestrator.stopAllServices();
    console.log("✓ Container stopped");
  } catch (error) {
    console.error("Error:", error);
    await orchestrator.stopAllServices();
    process.exit(1);
  }
}

if (require.main === module) {
  runBasicExample();
}