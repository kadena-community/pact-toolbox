---
title: "Your First Project"
description: "Build a complete todo application with Pact smart contracts and modern web frameworks."
---

# Your First Project

Build a complete todo application with Pact smart contracts and modern web frameworks. This guide follows the patterns used in production Pact Toolbox applications.

## Quick Start

Create a new project with our scaffolding tool:

```bash
# Create a new project
pnpm create pact-toolbox-app my-todo-app

# Navigate to your project
cd my-todo-app

# Install dependencies
pnpm install

# Start the local blockchain
pnpm pact:start

# In another terminal, start the dev server
pnpm dev
```

## Project Structure

A modern Pact Toolbox project follows this structure:

```
my-todo-app/
├── pact/                      # Smart contracts
│   ├── todos.pact            # Todo contract
│   ├── todos.pact.d.ts       # Auto-generated types
│   └── todos.repl            # Contract tests
├── src/
│   ├── api/                  # API layer
│   │   └── api.ts           # Contract interactions
│   ├── components/           # UI components
│   │   ├── TodoList.tsx
│   │   └── TodoItem.tsx
│   ├── App.tsx              # Main app with wallet setup
│   └── main.tsx             # Entry point
├── scripts/                  # Deployment scripts
│   └── deploy.ts
├── tests/                    # E2E tests
├── pact-toolbox.config.ts   # Network configuration
├── vite.config.ts           # Build configuration
└── package.json
```

## Essential Configuration

### pact-toolbox.config.ts

Configure your networks and development environment:

```typescript
import {
  createDevNetNetworkConfig,
  createMainNetNetworkConfig,
  createPactServerNetworkConfig,
  createTestNetNetworkConfig,
  defineConfig,
} from "pact-toolbox";

export default defineConfig({
  defaultNetwork: "devnet",
  preludes: ["kadena/chainweb"], // Auto deploy/download Kadena preludes to pact server
  downloadPreludes: true,
  deployPreludes: true,
  networks: {
    pactServer: createPactServerNetworkConfig(),
    devnet: createDevNetNetworkConfig(),
    testnet: createTestNetNetworkConfig(),
    mainnet: createMainNetNetworkConfig(),
  },
});
```

### vite.config.ts

Add the Pact plugin to your Vite configuration:

```typescript
import react from "@vitejs/plugin-react";
import pactVitePlugin from "@pact-toolbox/unplugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    pactVitePlugin(), // Enables Pact transformation to ts/js code and autostart devnets
  ],
});
```

## Writing Your First Smart Contract

Create `pact/todos.pact`:

```lisp
(namespace 'free)

(module todos GOVERNANCE
  "A todo list smart contract"

  (defcap GOVERNANCE ()
    "Module governance capability"
    true)

  ;; Define the todo schema
  (defschema todo
    id:string
    title:string
    completed:bool
    deleted:bool)

  ;; Create the todos table
  (deftable todo-table:{todo})

  (defun create-todo:string (id:string title:string)
    "Create a new todo item"
    (insert todo-table id {
      "id": id,
      "title": title,
      "completed": false,
      "deleted": false
    }))

  (defun toggle-todo:string (id:string)
    "Toggle todo completion status"
    (with-read todo-table id { "completed":= completed }
      (update todo-table id { "completed": (not completed) })))

  (defun get-todos:[object{todo}] ()
    "Get all non-deleted todos"
    (select todo-table (where "deleted" (= false))))

  (defun get-todo:object{todo} (id:string)
    "Get a specific todo by ID"
    (read todo-table id))
)
```

## TypeScript Integration

Pact Toolbox automatically generates TypeScript types. After saving your contract, you'll see `pact/todos.pact.d.ts` with:

```typescript
// Auto-generated from todos.pact
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  deleted: boolean;
}

// builder API for building transactions
export const createTodo: (id: string, title: string) => TransactionBuilder;
export const toggleTodo: (id: string) => TransactionBuilder;
export const getTodos: () => TransactionBuilder<Todo[]>;
export const getTodo: (id: string) => TransactionBuilder<Todo>;
```

## Creating the API Layer

Create `src/api/api.ts` to interact with your smart contract:

```typescript
// Import directly from your Pact files
import * as todosContract from "~/pact/todos.pact";

// Helper to generate unique IDs
function getUuid() {
  return crypto.randomUUID();
}

// Read operations use dirtyRead() for quick queries
export async function getAllTodos() {
  return todosContract.getTodos().build().dirtyRead();
}

export async function getTodoById(id: string) {
  return todosContract.getTodo(id).build().dirtyRead();
}

// Write operations use sign() and submitAndListen()
export async function createTodo(title: string) {
  const id = getUuid();
  return todosContract.createTodo(id, title).sign().submitAndListen();
}

export async function toggleTodoStatus(id: string) {
  return todosContract.toggleTodo(id).sign().submitAndListen();
}
```

Key patterns:

- **Direct imports** from `.pact` files
- **dirtyRead()** for fast read operations
- **sign().submitAndListen()** for write operations
- **Type safety** throughout

## Setting Up Wallet Integration

Create `src/App.tsx` with wallet setup:

```tsx
import { useQuery } from "@tanstack/react-query";
import { setupWallets } from "@pact-toolbox/wallet-adapters";
import { getGlobalNetworkContext } from "@pact-toolbox/transaction";
import { TodoList } from "./components/TodoList";

function App() {
  const { isLoading } = useQuery({
    queryKey: ["wallets/setup"],
    queryFn: async () => {
      // Initialize network context
      getGlobalNetworkContext();

      // Setup available wallets
      return setupWallets({
        autoConnect: true,
        wallets: ["keypair", "ecko", "chainweaver", "zelcore"],
      });
    },
  });

  return isLoading ? <div>Loading wallets...</div> : <TodoList />;
}

export default App;
```

## Building the UI

Create `src/components/TodoList.tsx`:

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllTodos, createTodo, toggleTodoStatus } from "../api/api";

export function TodoList() {
  const queryClient = useQueryClient();

  // Fetch todos
  const { data: todos = [], isLoading } = useQuery({
    queryKey: ["todos"],
    queryFn: getAllTodos,
  });

  // Create todo mutation
  const createMutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  // Toggle todo mutation
  const toggleMutation = useMutation({
    mutationFn: toggleTodoStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  if (isLoading) return <div>Loading todos...</div>;

  return (
    <div>
      <h1>My Todos</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.target as HTMLFormElement;
          const input = form.elements.namedItem("title") as HTMLInputElement;
          createMutation.mutate(input.value);
          form.reset();
        }}
      >
        <input name="title" placeholder="What needs to be done?" />
        <button type="submit">Add Todo</button>
      </form>

      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <input type="checkbox" checked={todo.completed} onChange={() => toggleMutation.mutate(todo.id)} />
            <span>{todo.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Testing Your Contract

Create `pact/todos.repl` for REPL-based testing:

```lisp
;; Load repl prelude
(load "prelude/init.repl")
;; Load your contract
(load "todos.pact")

(begin-tx "add todos")
(expect "should have empty todos" (free.todos.get-todos) [])
(expect "should add a todo" (free.todos.create-todo "1" "Hello, World!") "Write succeeded")
(expect "should have one todo" (free.todos.get-todos) [{"completed": false,"deleted": false,"id": "1","title": "Hello, World!"}])
(commit-tx)
```

Run the tests:

```bash
# Run all REPL and vitest tests
pnpm pact-toolbox test

# Or run specific test file with pact cli
pact pact/todos.repl
```

## Development Workflow

### 1. Start Development Server

```bash
# Start Vite dev server which will automatically start the proper devnet or pact-server based on the config
pnpm dev
```

This enables:

- Hot Module Replacement
- Automatic TypeScript generation
- Live contract redeploying

### 2. Make Contract Changes

When you edit `pact/todos.pact`:

1. **Save the file** - Types auto-generate, contract re-deployed
2. **See updates** - UI reflects new functionality

Example: Adding a delete function:

```lisp
(defun delete-todo:string (id:string)
  "Mark todo as deleted"
  (update todo-table id { "deleted": true }))
```

The TypeScript types update automatically:

```typescript
// pact/todos.pact.d.ts (auto-generated)
export const deleteTodo: (id: string) => TransactionBuilder;
```

Use it immediately in your API:

```typescript
// src/api/api.ts
export async function deleteTodo(id: string) {
  return todosContract.deleteTodo(id).sign().submitAndListen();
}
```

## Essential Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm pact:start       # Start local network if you want
pnpm pact:prelude     # Download the configured preludes eg "kadena/chainweb" or "kadena/maramalade"

# Testing
pnpm test             # Run all tests
pnpm pact:test        # Run Pact REPL tests

# Building
pnpm build            # Build for production
pnpm preview          # Preview production build

# Contract Management
pnpm pact:run <script> # Run automation/deployment scripts
```

## Deployment Script

Create `scripts/deploy.ts` to deploy your contracts:

```typescript
import { createScript } from "@pact-toolbox/script";

export default createScript({
  metadata: {
    name: "deploy-todos",
    description: "Deploy the todos contract to testnet",
    version: "1.0.0",
    author: "Pact Toolbox",
    tags: ["deployment", "todos", "testnet"],
  },

  autoStartNetwork: false,
  persist: false,
  profile: true,
  timeout: 300000, // 5 minutes

  async run(ctx) {
    const { logger, deployments, network, chainId, config, client } = ctx;

    logger.info(`🚀 Deploying todos contract to ${network} on chain ${chainId}`);

    // Debug network configuration
    const networkConfig = client.getNetworkConfig();

    try {
      // Deploy the todos contract to testnet
      const result = await deployments.deploy("todos", {
        // Basic deployment options
        gasLimit: 100000,
        gasPrice: 0.00001,
        skipIfAlreadyDeployed: true,

        // Validation and verification
        validate: true,
        verify: false,

        // Namespace handling eg, create proper principal namespace
        namespaceHandling: {
          autoCreate: false, // todos uses 'free namespace which should exist
          skipNamespaceHandling: false,
          chainId: chainId,
        },

        // Contract initialization data
        data: {
          upgrade: false, // First deployment
        },

        // Deployment hooks
        hooks: {
          preDeploy: async (contractName, source) => {
            logger.info(`📋 Pre-deploy validation for ${contractName}`);
          },
          postDeploy: async (contractName, deployResult) => {
            logger.success(`✅ ${contractName} deployed successfully!`);
          },
          onError: async (contractName, error) => {
            logger.error(`❌ Deployment failed for ${contractName}:`, error);
          },
        },
      });

      // Log final deployment summary
      logger.box("🎉 Deployment Summary");

      return result;
    } catch (error) {
      logger.error("💥 Deployment failed:", error);
      throw error;
    }
  },
});
```

Run deployment:

```bash
# with script path
pnpm pact:run scripts/deploy.ts
# or with just name
pnpm pact:run deploy
```

## Best Practices

### 1. Contract Design

- Use schemas for type safety
- Keep functions focused and simple
- Add documentation strings
- Use capabilities for permissions

### 2. TypeScript Integration

- Import directly from `.pact` files
- Use the builder API for transactions
- Handle errors appropriately
- Leverage auto-generated types

### 3. Testing Strategy

- Write REPL tests for contract logic
- Use Vitest for integration tests
- Test both success and failure cases

### 4. Performance Tips

- Use `dirtyRead()` for queries
- Batch operations when possible
- Cache frequently accessed data
