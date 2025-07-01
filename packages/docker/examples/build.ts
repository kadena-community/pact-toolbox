import { ContainerOrchestrator } from "../src/orchestrator";
import type { DockerServiceConfig } from "../src/types";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Example showing how to build and run a Docker image
 */
async function runBuildExample() {
  // Create a temporary build context
  const buildContext = join(tmpdir(), `docker-build-${Date.now()}`);
  mkdirSync(buildContext, { recursive: true });

  // Create a simple Dockerfile
  const dockerfile = `
FROM node:18-alpine
WORKDIR /app
RUN echo '{"name":"test","version":"1.0.0"}' > package.json
RUN echo 'console.log("Hello from built container!");' > index.js
CMD ["node", "index.js"]
`;
  writeFileSync(join(buildContext, "Dockerfile"), dockerfile);

  const orchestrator = new ContainerOrchestrator({
    networkName: "build-network",
  });

  const service: DockerServiceConfig = {
    containerName: "built-app",
    image: "test-app:latest",
    build: {
      context: buildContext,
      dockerfile: "Dockerfile",
    },
  };

  try {
    console.log("Building Docker image...");
    await orchestrator.startServices([service]);
    console.log("✓ Image built and container started");

    // Get logs from the container
    const logs = await orchestrator.getServiceLogs("built-app");
    console.log("Container output:", logs.join("\n"));

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
  runBuildExample();
}