---
title: "Introduction"
description: "The modern way to build on Kadena - where Pact smart contracts meet TypeScript development"
---

# Introduction

Pact Toolbox transforms how developers build on Kadena by treating Pact as a first-class citizen in the TypeScript ecosystem. Import smart contracts like JavaScript modules, get instant type safety, and deploy with confidence.

```typescript
// This is all it takes to interact with a Pact smart contract
import * as todos from "./pact/todos.pact";

await todos.createTodo("1", "Build on Kadena").sign().submitAndListen();
```

## Why We Built This

Building on Kadena traditionally meant juggling multiple tools, manual type definitions, and complex deployment scripts. We believed there was a better way - one where smart contracts integrate seamlessly with modern web development.

Pact Toolbox emerged from real-world experience building production applications on Kadena. Every feature addresses actual pain points developers face:

- **Direct imports from .pact files** - No more manual contract loading
- **Automatic TypeScript generation** - Your IDE knows your contract's API
- **Fluent transaction builder** - Compose complex transactions with ease
- **Unified wallet interface** - One API for all Kadena wallets
- **Integrated testing** - Test contracts alongside your application code

## The Developer Experience

### Write Pact, Import TypeScript

```lisp
;; todos.pact
(defun create-todo:string (id:string title:string)
  "Create a new todo item"
  (insert todo-table id {
    "id": id,
    "title": title,
    "completed": false
  }))
```

```typescript
// Automatically generated types and functions
import { createTodo } from "./todos.pact";

const result = await createTodo("1", "Learn Pact").sign().submitAndListen();
```

### Compose Transactions Naturally

```typescript
// Build complex transactions with a fluent API
const transfer = execution('(coin.transfer "alice" "bob" 10.0)')
  .withSigner("alice", (signFor) => [signFor("coin.TRANSFER", "alice", "bob", 10.0)])
  .withChainId("1")
  .withGasLimit(1500);

// Execute when ready
const result = await transfer.sign().submitAndListen();
```

### Test Like You Mean It

```lisp
// REPL tests for contract logic
(begin-tx "Create todos")
(expect "empty todos" (get-todos) [])
(create-todo "1" "First todo")
(expect "one todo" (length (get-todos)) 1)
(commit-tx)
```

```typescript
// Integration tests with your app
it("should create a todo", async () => {
  const todo = await createTodo("1", "Test todo").sign().submitAndListen();

  expect(todo.status).toBe("success");
});
```

## Architecture That Makes Sense

### Rust Where It Counts

We use Rust for performance-critical operations:

- **Tree-sitter parser** for instant Pact analysis
- **NAPI-RS bindings** for seamless TypeScript integration
- **Parser pooling** for optimal resource usage

### TypeScript Where It Matters

Developer-facing APIs are pure TypeScript:

- **Fluent transaction builder** with method chaining
- **Auto-generated types** from your contracts
- **Framework integrations** for React, Vue, and more

### Zero Dependencies Where Possible

Core packages like `chainweb-client` have zero runtime dependencies:

- **Smaller bundles** for your applications
- **Faster installs** during development
- **Fewer security concerns** in production

## Built for Real Applications

### Handle Complexity Gracefully

```typescript
// Multi-chain deployments
await deploy("my-contract").toChains(["0", "1", "2", "3"]).withNamespace("my-app").sign().execute();

// Cross-chain transfers
await crossChainTransfer({
  from: { chain: "0", account: "alice" },
  to: { chain: "1", account: "bob" },
  amount: 100,
})
  .sign()
  .submitAndListen();
```

### Deploy with Confidence

```typescript
// Automated deployment scripts
export default createScript({
  name: "deploy-production",
  async run(ctx) {
    const { logger, deployments } = ctx;

    // Deploy with automatic validation
    await deployments.deploy("my-contract", {
      validate: true,
      skipIfAlreadyDeployed: true,
      hooks: {
        preDeploy: () => logger.info("Starting deployment..."),
        postDeploy: () => logger.success("Deployed successfully!"),
      },
    });
  },
});
```

## Start Building Today

```bash
pnpm create pact-toolbox-app my-dapp
cd my-dapp
pnpm dev
```

Your new project includes:

- Complete todo application example
- TypeScript configuration
- Testing setup with examples
- Local blockchain environment
- Production build pipeline

## Learn More

- **[First Project Guide](/getting-started/first-project)** - Build your first Kadena application
- **[API Reference](/api/)** - Explore all 25+ packages
- **[GitHub](https://github.com/kadena-community/pact-toolbox)** - Contribute or report issues
- **[Discord](https://discord.gg/kadena)** - Get help from the community

---

_Pact Toolbox is open source and actively developed by the Kadena community. We welcome contributions and feedback._
