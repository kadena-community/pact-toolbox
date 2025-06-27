import { ContainerOrchestrator } from "../src/orchestrator";
import type { ContainerConfig } from "../src/types";

/**
 * Example showing Docker Compose-like features of the Docker package
 */
async function runMultiServiceApp() {
  const orchestrator = new ContainerOrchestrator({
    defaultNetwork: "myapp-network",
    enableMetrics: false,
  });

  // Define services similar to a docker-compose.yml
  const services: Record<string, ContainerConfig> = {
    // Database service
    postgres: {
      id: "postgres",
      name: "myapp-postgres",
      image: "postgres",
      tag: "15-alpine",
      restart: "unless-stopped",
      env: {
        POSTGRES_USER: "myapp",
        POSTGRES_PASSWORD: "secretpassword",
        POSTGRES_DB: "myapp_db",
      },
      volumes: [
        { host: "postgres_data", container: "/var/lib/postgresql/data", mode: "rw" },
      ],
      ports: [{ host: 5432, container: 5432 }],
      healthCheck: {
        test: ["CMD-SHELL", "pg_isready -U myapp"],
        interval: "10s",
        timeout: "5s",
        retries: 5,
      },
    },

    // Redis cache service
    redis: {
      id: "redis",
      name: "myapp-redis",
      image: "redis",
      tag: "7-alpine",
      restart: "unless-stopped",
      command: ["redis-server", "--appendonly", "yes"],
      volumes: [
        { host: "redis_data", container: "/data", mode: "rw" },
      ],
      ports: [{ host: 6379, container: 6379 }],
      healthCheck: {
        test: ["CMD", "redis-cli", "ping"],
        interval: "10s",
        timeout: "5s",
        retries: 5,
      },
    },

    // Backend API service
    backend: {
      id: "backend",
      name: "myapp-backend",
      image: "node",
      tag: "18-alpine",
      restart: "unless-stopped",
      dependencies: ["postgres", "redis"], // Wait for database and cache
      workingDir: "/app",
      volumes: [
        { host: "./backend", container: "/app", mode: "rw" },
      ],
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://myapp:secretpassword@postgres:5432/myapp_db",
        REDIS_URL: "redis://redis:6379",
        PORT: "3000",
      },
      command: ["npm", "start"],
      ports: [{ host: 3000, container: 3000 }],
      healthCheck: {
        test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"],
        interval: "30s",
        timeout: "10s",
        retries: 3,
        startPeriod: "40s",
      },
    },

    // Frontend service
    frontend: {
      id: "frontend",
      name: "myapp-frontend",
      image: "nginx",
      tag: "alpine",
      restart: "unless-stopped",
      dependencies: ["backend"], // Wait for backend API
      volumes: [
        { host: "./frontend/dist", container: "/usr/share/nginx/html", mode: "ro" },
        { host: "./nginx/default.conf", container: "/etc/nginx/conf.d/default.conf", mode: "ro" },
      ],
      ports: [{ host: 80, container: 80 }],
      labels: {
        "traefik.enable": "true",
        "traefik.http.routers.frontend.rule": "Host(`myapp.local`)",
      },
    },

    // Background worker service
    worker: {
      id: "worker",
      name: "myapp-worker",
      image: "node",
      tag: "18-alpine",
      restart: "unless-stopped",
      dependencies: ["postgres", "redis"], // Same dependencies as backend
      workingDir: "/app",
      volumes: [
        { host: "./backend", container: "/app", mode: "rw" },
      ],
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://myapp:secretpassword@postgres:5432/myapp_db",
        REDIS_URL: "redis://redis:6379",
        WORKER_CONCURRENCY: "5",
      },
      command: ["npm", "run", "worker"],
    },
  };

  // Event handlers
  orchestrator.on("started", (id, _state) => {
    console.log(`✅ [${new Date().toISOString()}] ${id} started`);
  });

  orchestrator.on("failed", (id, error) => {
    console.error(`❌ [${new Date().toISOString()}] ${id} failed:`, error.message);
  });

  orchestrator.on("healthy", (id) => {
    console.log(`💚 [${new Date().toISOString()}] ${id} is healthy`);
  });

  orchestrator.on("stopped", (id) => {
    console.log(`🛑 [${new Date().toISOString()}] ${id} stopped`);
  });

  try {
    console.log("🚀 Starting multi-service application...\n");
    
    // Start all services
    await orchestrator.startServices(services);
    
    console.log("\n✨ All services started!");
    console.log("📊 Service status:");
    
    // Show running containers
    const containers = orchestrator.getAllContainers();
    for (const [id, state] of containers.entries()) {
      console.log(`  - ${id}: ${state.status} (ports: ${state.ports.join(", ") || "none"})`);
    }
    
    console.log("\n🌐 Application URLs:");
    console.log("  - Frontend: http://localhost");
    console.log("  - Backend API: http://localhost:3000");
    console.log("  - PostgreSQL: localhost:5432");
    console.log("  - Redis: localhost:6379");
    
    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n\n🛑 Shutting down services...");
      await orchestrator.stopAll();
      console.log("👋 All services stopped. Goodbye!");
      process.exit(0);
    });
    
    // Keep process alive
    console.log("\n💡 Press Ctrl+C to stop all services\n");
    
  } catch (error) {
    console.error("\n❌ Failed to start application:", error);
    console.log("🧹 Cleaning up...");
    await orchestrator.stopAll(true);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMultiServiceApp().catch(console.error);
}