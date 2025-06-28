---
title: "Pactup - Pact Version Manager"
description: "Pactup is the easiest way to install and manage multiple versions of the Pact programming language on your system."
---

# Pactup - Pact Version Manager

Pactup is the easiest way to install and manage multiple versions of the Pact programming language on your system.

## What is Pactup?

Pactup is a version manager for Pact that allows you to:

- Install multiple versions of Pact side by side
- Switch between versions instantly
- Manage global and project-specific Pact versions
- Keep your Pact installation up to date

## Installation

### Quick Install (Recommended)

```bash
# Install pactup
curl -L https://pactup.kadena.io/install.sh | bash

# Reload your shell
source ~/.bashrc  # or ~/.zshrc
```

### Manual Installation

#### macOS

```bash
# Using Homebrew
brew install kadena-io/pactup/pactup

# Or download manually
curl -L https://github.com/kadena-io/pactup/releases/latest/download/pactup-macos.tar.gz | tar -xz
sudo mv pactup /usr/local/bin/
```

#### Linux

```bash
# Download and install
curl -L https://github.com/kadena-io/pactup/releases/latest/download/pactup-linux.tar.gz | tar -xz
sudo mv pactup /usr/local/bin/
```

#### Windows

```powershell
# Using winget
winget install Kadena.Pactup

# Or download from releases
# https://github.com/kadena-io/pactup/releases
```

### Verify Installation

```bash
# Check pactup version
pactup --version

# List available commands
pactup --help
```

## Basic Usage

### Installing Pact Versions

```bash
# Install the latest stable version
pactup install latest

# Install a specific version
pactup install 4.12.0

# Install the latest LTS version
pactup install lts

# List available versions
pactup list-remote
```

### Managing Versions

```bash
# List installed versions
pactup list

# Use a specific version globally
pactup use 4.12.0

# Use a specific version for current shell
pactup exec 4.12.0 pact --version

# Set default version
pactup default 4.12.0
```

### Project-Specific Versions

Create a `.pact-version` file in your project root:

```bash
# Set project version
echo "4.12.0" > .pact-version

# pactup will automatically use this version when you cd into the directory
cd your-project
pact --version  # Uses version from .pact-version
```

## Advanced Configuration

### Shell Integration

Add to your shell configuration file (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
# Auto-switch Pact versions based on .pact-version files
eval "$(pactup init)"

# Add pactup to PATH
export PATH="$HOME/.pactup/bin:$PATH"
```

### Environment Variables

```bash
# Custom pactup installation directory
export PACTUP_DIR="$HOME/.pactup"

# Disable automatic version switching
export PACTUP_AUTO_SWITCH=false

# Set download mirror
export PACTUP_MIRROR="https://mirror.example.com"
```

## Integration with Pact Toolbox

Pact Toolbox automatically detects and uses pactup-managed Pact installations:

```typescript
// pact-toolbox.config.ts
export default defineConfig({
  pact: {
    // Automatically use version from .pact-version
    version: "auto",

    // Or specify a version explicitly
    // version: '4.12.0',

    // Use pactup to manage versions
    versionManager: "pactup",
  },
});
```

## Common Workflows

### Setting Up a New Project

```bash
# Navigate to your project
cd my-pact-project

# Set Pact version for this project
echo "4.12.0" > .pact-version

# Install dependencies with Pact Toolbox
pnpm create pact-toolbox-app . --pact-version=4.12.0

# Start development
pnpm dev
```

### Upgrading Pact Version

```bash
# Check current version
pact --version

# See available versions
pactup list-remote

# Install new version
pactup install 4.13.0

# Test with new version
pactup exec 4.13.0 pact --version

# Switch globally if tests pass
pactup use 4.13.0
pactup default 4.13.0
```

### Working with Multiple Projects

```bash
# Project A uses Pact 4.12.0
cd project-a
echo "4.12.0" > .pact-version

# Project B uses Pact 4.13.0
cd ../project-b
echo "4.13.0" > .pact-version

# pactup automatically switches versions when you cd
cd ../project-a && pact --version  # 4.12.0
cd ../project-b && pact --version  # 4.13.0
```

## Docker Integration

Use pactup in Docker containers:

```dockerfile
# Dockerfile
FROM node:18

# Install pactup
RUN curl -L https://pactup.kadena.io/install.sh | bash

# Add to PATH
ENV PATH="/root/.pactup/bin:$PATH"

# Install Pact version
RUN pactup install 4.12.0 && pactup default 4.12.0

# Copy project
COPY . .

# pactup will use version from .pact-version if present
RUN pnpm install && pnpm build
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        pact-version: ["4.12.0", "4.13.0", "latest"]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"

      - name: Install pactup
        run: curl -L https://pactup.kadena.io/install.sh | bash

      - name: Install Pact
        run: |
          source ~/.bashrc
          pactup install ${{ matrix.pact-version }}
          pactup use ${{ matrix.pact-version }}

      - name: Run tests
        run: |
          source ~/.bashrc
          pnpm install
          pnpm test
```

## Troubleshooting

### Common Issues

#### pactup not found

```bash
# Ensure pactup is in PATH
export PATH="$HOME/.pactup/bin:$PATH"

# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc
```

#### Permission denied

```bash
# Fix permissions
chmod +x ~/.pactup/bin/pactup

# Or reinstall
curl -L https://pactup.kadena.io/install.sh | bash
```

#### Version switching not working

```bash
# Enable auto-switching
eval "$(pactup init)"

# Or manually switch
pactup use $(cat .pact-version)
```

### Getting Help

```bash
# Show help
pactup --help

# Show help for specific command
pactup install --help

# Check configuration
pactup env
```

## Best Practices

### 1. Use .pact-version Files

Always specify Pact versions in your projects:

```bash
# In your project root
echo "4.12.0" > .pact-version
git add .pact-version
```

### 2. Document Requirements

Add Pact version to your README:

```markdown
## Requirements

- Node.js 18+
- Pact 4.12.0 (install with `pactup install 4.12.0`)
```

### 3. Test Multiple Versions

Use CI to test against multiple Pact versions:

```json
{
  "scripts": {
    "test:pact-4.12": "pactup exec 4.12.0 pnpm test",
    "test:pact-4.13": "pactup exec 4.13.0 pnpm test",
    "test:all-versions": "pnpm test:pact-4.12 && pnpm test:pact-4.13"
  }
}
```

### 4. Keep Updated

Regularly update pactup and check for new Pact versions:

```bash
# Update pactup
pactup self-update

# Check for new Pact versions
pactup list-remote

# Update to latest
pactup install latest
```
