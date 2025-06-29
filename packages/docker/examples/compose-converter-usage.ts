import { ContainerOrchestrator } from "../src/orchestrator";
import { convertComposeFile } from "../src/compose-converter";
import { writeFileSync } from "fs";
import { join } from "path";

// Example docker-compose.yml content
const exampleComposeYml = `
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: myapp_db
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - backend

  redis:
    image: redis:7-alpine
    container_name: myapp_cache
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    networks:
      - backend

  api:
    image: node:20-alpine
    container_name: myapp_api
    working_dir: /app
    volumes:
      - ./api:/app
      - /app/node_modules
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:password@db:5432/myapp
      REDIS_URL: redis://redis:6379
    env_file:
      - .env
    ports:
      - "3000:3000"
    command: npm start
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped
    networks:
      - backend
      - frontend
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  web:
    image: nginx:alpine
    container_name: myapp_web
    volumes:
      - ./web/dist:/usr/share/nginx/html:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - frontend
    labels:
      traefik.enable: "true"
      traefik.http.routers.web.rule: "Host(\`myapp.com\`)"

  worker:
    image: node:20-alpine
    container_name: myapp_worker
    working_dir: /app
    volumes:
      - ./api:/app
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:password@db:5432/myapp
      REDIS_URL: redis://redis:6379
    command: npm run worker
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped
    networks:
      - backend
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  monitoring:
    image: prom/prometheus
    container_name: myapp_monitoring
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - backend
    profiles:
      - monitoring

volumes:
  postgres_data:
  redis_data:
  prometheus_data:

networks:
  backend:
    driver: bridge
  frontend:
    driver: bridge
`;

async function demonstrateComposeConverter() {
  console.log("🔄 Docker Compose Converter Demo\n");

  // Save the example compose file
  const composeFilePath = join(process.cwd(), "docker-compose.example.yml");
  writeFileSync(composeFilePath, exampleComposeYml);
  console.log(`📝 Created example docker-compose.yml at ${composeFilePath}\n`);

  // Convert the compose file
  console.log("🔧 Converting docker-compose.yml to TypeScript configs...\n");
  const { services, networks, volumes } = convertComposeFile(composeFilePath, "myapp");

  // Display converted services
  console.log("📦 Converted Services:");
  for (const [name, config] of Object.entries(services)) {
    console.log(`\n  ${name}:`);
    console.log(`    - Image: ${config.image}:${config.tag || "latest"}`);
    console.log(`    - Container: ${config.name}`);
    if (config.ports) {
      const ports = Array.isArray(config.ports) ? config.ports : [config.ports];
      console.log(`    - Ports: ${ports.map((p) => `${p.host}:${p.container}`).join(", ")}`);
    }
    if (config.dependsOn) {
      if (Array.isArray(config.dependsOn)) {
        console.log(`    - Depends on: ${config.dependsOn.join(", ")}`);
      } else {
        const deps = Object.entries(config.dependsOn)
          .map(([service, conf]) => `${service} (${conf.condition})`)
          .join(", ");
        console.log(`    - Depends on: ${deps}`);
      }
    }
    if (config.profiles) {
      console.log(`    - Profiles: ${config.profiles.join(", ")}`);
    }
  }

  console.log("\n🌐 Converted Networks:");
  for (const network of networks) {
    console.log(`  - ${network.name} (${network.driver || "bridge"})`);
  }

  console.log("\n💾 Converted Volumes:");
  for (const volume of volumes) {
    console.log(`  - ${volume.name} (${volume.driver || "local"})`);
  }

  // Create orchestrator and start services
  const orchestrator = new ContainerOrchestrator({
    projectName: "myapp",
    defaultNetwork: "myapp_backend",
  });

  // Set up event handlers
  orchestrator.on("started", (id, _state) => {
    console.log(`\n✅ [${new Date().toISOString()}] ${id} started`);
  });

  orchestrator.on("failed", (id, error) => {
    console.error(`\n❌ [${new Date().toISOString()}] ${id} failed:`, error.message);
  });

  orchestrator.on("healthy", (id) => {
    console.log(`\n💚 [${new Date().toISOString()}] ${id} is healthy`);
  });

  try {
    console.log("\n🚀 Starting services from converted config...\n");

    // Create networks first
    for (const network of networks) {
      await orchestrator.createNetwork(network);
    }

    // Create volumes
    for (const volume of volumes) {
      await orchestrator.createVolume(volume);
    }

    // Start services (excluding monitoring profile by default)
    await orchestrator.startServices(services);

    console.log("\n✨ All services started from docker-compose.yml!");
    console.log("\n📊 Service URLs:");
    console.log("  - Web: http://localhost");
    console.log("  - API: http://localhost:3000");
    console.log("  - PostgreSQL: localhost:5432");
    console.log("  - Redis: localhost:6379");

    // Demonstrate profile activation
    console.log("\n🔍 To start monitoring services, activate the 'monitoring' profile:");
    console.log("  orchestrator.setActiveProfiles(['monitoring']);");
    console.log("  await orchestrator.startContainer(services.monitoring);");

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n\n🛑 Shutting down services...");
      await orchestrator.stopAll();
      console.log("👋 All services stopped. Goodbye!");
      process.exit(0);
    });

    console.log("\n💡 Press Ctrl+C to stop all services\n");
  } catch (error) {
    console.error("\n❌ Failed to start services:", error);
    await orchestrator.stopAll(true);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  demonstrateComposeConverter().catch(console.error);
}
