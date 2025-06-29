# todo-mvc-vite

This project was generated with `create-pact-toolbox-app`.

## Prerequisites

- **Docker** Required to run devnet follow [docker-desktop](https://docs.docker.com/desktop/) to install and test docker.
- **Pact** Required to run pact code and start a local test server for development and running tests, follow [pactup](https://github.com/kadena-community/pactup) to install pact 5 or nightly version.

## Overview

This project is a starting point for developing Pact smart contracts with the Pact Toolbox. It includes a sample contract, a basic project structure, and a set of npm scripts to help you with your development workflow.

## Getting Started

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Start the development server:**

   ```bash
   pnpm dev
   ```

   This will start the Pact development server and the Vite development server.

## Available Scripts

In the project directory, you can run the following commands:

- `pnpm dev`: Starts the development server.
- `pnpm build`: Builds the project for production.
- `pnpm preview`: Previews the production build.
- `pnpm format`: Checks the formatting of your code.
- `pnpm type-check`: Checks for TypeScript errors.
- `pnpm pact:start`: Starts the Pact development server.
- `pnpm pact:test`: Runs your Pact tests.
- `pnpm pact:prelude`: Manages prelude files for your Pact contracts.
- `pact:types`: Generates TypeScript types from your Pact contracts.
- `pact:run`: Runs a Pact script.

## Switch networks

Update the `defaultNetwork` key inside `pact-toolbox.config.ts` make sure its one of the configured networks

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)
