---
title: "Docker Setup"
description: "Use Docker to create consistent, isolated development environments for Pact smart contract development."
---

# Docker Setup

Use Docker to create consistent, isolated development environments for Pact smart contract development.

## Why Use Docker?

Docker provides several advantages for Pact development:

- **Consistent Environment**: Same setup across all machines
- **Isolated DevNet**: Local blockchain that doesn't interfere with other projects
- **Easy Cleanup**: Tear down and rebuild environments instantly
- **Production Parity**: Mirror production environments locally
- **Team Collaboration**: Share exact development setups

## Prerequisites

### Install Docker

#### macOS

```bash
# Download Docker Desktop
# https://www.docker.com/products/docker-desktop/

# Or using Homebrew
brew install --cask docker
```

#### Linux (Ubuntu/Debian)

```bash
# Update package index
sudo apt-get update

# Install Docker
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Restart shell or log out/in
newgrp docker
```

#### Windows

```powershell
# Download Docker Desktop
# https://www.docker.com/products/docker-desktop/

# Or using winget
winget install Docker.DockerDesktop
```

### Verify Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose
docker compose version

# Test Docker installation
docker run hello-world
```

## Quick Start with Pact Toolbox

### Using Docker Compose (Recommended)

Pact Toolbox includes Docker configurations out of the box:

```bash
# Create a new project with Docker support
pnpm create pact-toolbox-app my-docker-app --docker

# Navigate to your project
cd my-docker-app

# Start development environment
docker compose up -d

# Your app is now running at http://localhost:3000
# DevNet is available at http://localhost:8080
```

### Manual Docker Setup

If you have an existing project:

```bash
# Add Docker support to existing project
pnpm pact-toolbox init --docker

# Or copy example configurations
cp node_modules/@pact-toolbox/config/docker/* .
```

## Docker Configuration Files

### docker-compose.yml

```yaml
version: "3.8"

services:
  # Main application
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - KADENA_NETWORK=devnet
      - KADENA_API_HOST=http://devnet:8080
    depends_on:
      - devnet
    command: pnpm dev

  # Local Kadena DevNet
  devnet:
    image: kadena/devnet:latest
    ports:
      - "8080:8080"
    environment:
      - KADENA_CHAIN_COUNT=1
      - KADENA_MINING_ENABLED=true
    volumes:
      - devnet_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # PostgreSQL for data persistence (optional)
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=pact_toolbox
      - POSTGRES_USER=pact
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  devnet_data:
  postgres_data:
```

### Dockerfile

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Development stage
FROM base AS development
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

# Build stage
FROM development AS build
RUN pnpm build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
COPY --from=base /usr/local/bin/pnpm /usr/local/bin/
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["pnpm", "start"]
```

### .dockerignore

```text
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/

# Environment files
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage
coverage/
.nyc_output

# IDEs
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Git
.git/
.gitignore

# Docker
Dockerfile*
docker-compose*
.dockerignore

# CI/CD
.github/
```

## Development Workflow

### Starting Development

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Check service status
docker compose ps
```

### Common Commands

```bash
# Build containers
docker compose build

# Start specific service
docker compose up devnet

# Stop all services
docker compose down

# Remove volumes (clean slate)
docker compose down -v

# Execute commands in running container
docker compose exec app pnpm test

# Shell into container
docker compose exec app sh
```

### Hot Reloading

The development setup supports hot reloading:

```yaml
# In docker-compose.yml
services:
  app:
    volumes:
      - .:/app # Mount source code
      - /app/node_modules # Exclude node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true # For Windows
```

## DevNet Configuration

### Custom DevNet Setup

```yaml
# docker-compose.override.yml
services:
  devnet:
    environment:
      # Multiple chains
      - KADENA_CHAIN_COUNT=4

      # Custom gas settings
      - KADENA_GAS_LIMIT=100000
      - KADENA_GAS_PRICE=0.00001

      # Mining configuration
      - KADENA_MINING_ENABLED=true
      - KADENA_BLOCK_TIME=5s

      # Initial accounts
      - KADENA_GENESIS_ACCOUNTS=alice,bob,charlie
    ports:
      - "8080-8083:8080-8083" # Multiple chain ports
```

### DevNet Data Persistence

```bash
# Backup DevNet data
docker compose exec devnet tar -czf /tmp/devnet-backup.tar.gz /data

# Copy backup to host
docker cp $(docker compose ps -q devnet):/tmp/devnet-backup.tar.gz ./devnet-backup.tar.gz

# Restore DevNet data
docker cp ./devnet-backup.tar.gz $(docker compose ps -q devnet):/tmp/
docker compose exec devnet tar -xzf /tmp/devnet-backup.tar.gz -C /
```

## Production Setup

### Multi-Stage Builds

```dockerfile
# Production-optimized Dockerfile
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:18-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S pactapp -u 1001

# Copy built application
COPY --from=builder --chown=pactapp:nodejs /app/dist ./dist
COPY --from=builder --chown=pactapp:nodejs /app/node_modules ./node_modules
COPY --chown=pactapp:nodejs package.json ./

USER pactapp
EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Health Checks

```dockerfile
# Add health check to Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

```yaml
# In docker-compose.yml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Networking

### Service Communication

Services can communicate using service names:

```typescript
// In your application
const client = createPactClient({
  network: "devnet",
  host: "http://devnet:8080", // Use service name
});
```

### External Access

```yaml
# docker-compose.yml
services:
  app:
    ports:
      - "3000:3000" # App accessible at localhost:3000

  devnet:
    ports:
      - "8080:8080" # DevNet accessible at localhost:8080
```

### Custom Networks

```yaml
# docker-compose.yml
networks:
  pact-network:
    driver: bridge

services:
  app:
    networks:
      - pact-network

  devnet:
    networks:
      - pact-network
```

## Environment Variables

### .env Files

```bash
# .env
NODE_ENV=development
KADENA_NETWORK=devnet
KADENA_API_HOST=http://devnet:8080
DATABASE_URL=postgres://pact:password@db:5432/pact_toolbox
```

### Docker Compose Variables

```yaml
# docker-compose.yml
services:
  app:
    env_file:
      - .env
      - .env.local
    environment:
      - PORT=3000
      - DEBUG=pact-toolbox:*
```

## Volume Management

### Types of Volumes

```yaml
services:
  app:
    volumes:
      # Named volume for data persistence
      - app_data:/app/data

      # Bind mount for development
      - .:/app

      # Anonymous volume for node_modules
      - /app/node_modules

volumes:
  app_data:
```

### Backup and Restore

```bash
# Backup named volume
docker run --rm -v pact_devnet_data:/data -v $(pwd):/backup alpine tar czf /backup/devnet-backup.tar.gz /data

# Restore named volume
docker run --rm -v pact_devnet_data:/data -v $(pwd):/backup alpine tar xzf /backup/devnet-backup.tar.gz -C /
```

## Performance Optimization

### Build Performance

```dockerfile
# Use build cache
FROM node:18-alpine
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci --only=production

# Copy source last
COPY . .
RUN npm run build
```

### Runtime Performance

```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
        reservations:
          cpus: "0.5"
          memory: 512M
```

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port
lsof -i :8080

# Kill process
kill -9 <PID>

# Or use different port
docker compose up --port 8081:8080
```

#### Permission Denied

```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Or run with sudo (not recommended)
sudo docker compose up
```

#### Container Won't Start

```bash
# Check logs
docker compose logs app

# Debug container
docker compose run --rm app sh

# Check container status
docker compose ps
```

### Performance Issues

```bash
# Monitor resource usage
docker stats

# Check disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/docker.yml
name: Docker Build and Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t pact-app .

      - name: Start services
        run: docker compose up -d

      - name: Run tests
        run: docker compose exec -T app pnpm test

      - name: Stop services
        run: docker compose down -v
```

### Production Deployment

```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  app:
    image: your-registry/pact-app:latest
    environment:
      - NODE_ENV=production
      - KADENA_NETWORK=mainnet
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
```

## Best Practices

### 1. Use Multi-Stage Builds

Separate build and runtime environments for smaller production images.

### 2. Leverage Build Cache

Structure Dockerfiles to maximize layer caching.

### 3. Use .dockerignore

Exclude unnecessary files to speed up builds.

### 4. Health Checks

Always include health checks for production services.

### 5. Resource Limits

Set appropriate CPU and memory limits.

### 6. Security

- Use non-root users
- Scan images for vulnerabilities
- Keep base images updated

