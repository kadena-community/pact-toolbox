import { ContainerOrchestrator } from "../src/orchestrator";
import type { DockerServiceConfig } from "../src/types";

/**
 * Example showing Docker Compose-like features with dependencies
 */
async function runComposeExample() {
  const orchestrator = new ContainerOrchestrator({
    networkName: "app-network",
    volumes: ["postgres_data"],
  });

  const services: DockerServiceConfig[] = [
    // Database
    {
      containerName: "postgres",
      image: "postgres:15-alpine",
      environment: {
        POSTGRES_PASSWORD: "secret",
        POSTGRES_DB: "testdb",
      },
      volumes: ["postgres_data:/var/lib/postgresql/data"],
      ports: [{ target: 5432, published: 5432 }],
      healthCheck: {
        Test: ["CMD-SHELL", "pg_isready -U postgres"],
        Interval: 5000000000,
        Timeout: 3000000000,
        Retries: 5,
      },
    },
    // App that depends on database
    {
      containerName: "app",
      image: "nginx:alpine", // Using nginx as placeholder
      dependsOn: {
        "postgres": { condition: "service_healthy" }
      },
      environment: {
        DB_HOST: "postgres",
        DB_PORT: "5432",
      },
      ports: [{ target: 80, published: 8080 }],
    },
  ];

  // Setup graceful shutdown
  orchestrator.setupGracefulShutdown();

  try {
    console.log("Starting services with dependencies...");
    await orchestrator.startServices(services);
    console.log("✓ All services started");
    console.log("  - PostgreSQL at localhost:5432");
    console.log("  - App at http://localhost:8080");

    // Stream logs from all services
    await orchestrator.streamAllLogs();

    // Keep running until interrupted
    console.log("\nPress Ctrl+C to stop all services");
    await new Promise(() => {}); // Run forever
  } catch (error) {
    console.error("Error:", error);
    await orchestrator.stopAllServices();
    process.exit(1);
  }
}

if (require.main === module) {
  runComposeExample();
}