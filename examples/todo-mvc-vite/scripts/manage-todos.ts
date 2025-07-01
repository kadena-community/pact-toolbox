import { createScript } from "@pact-toolbox/script";

export interface TodoArgs {
  action?: "create" | "toggle" | "update" | "delete" | "list" | "clear";
  id?: string;
  title?: string;
  count?: number;
}

export default createScript<TodoArgs>({
  metadata: {
    name: "manage-todos",
    description: "Manage todos - create, update, delete, toggle, list",
    version: "1.0.0",
    author: "Pact Toolbox",
    tags: ["todos", "crud", "management"],
  },

  autoStartNetwork: true,
  persist: false,
  timeout: 30000,

  async run(ctx) {
    const { logger, utils, deployer, args } = ctx;
    const action = args.action || "list";

    logger.info(`📋 Todo Management Script - Action: ${action}`);

    switch (action) {
      case "create":
        return await createTodos(ctx);

      case "toggle":
        return await toggleTodo(ctx);

      case "update":
        return await updateTodo(ctx);

      case "delete":
        return await deleteTodo(ctx);

      case "list":
        return await listTodos(ctx);

      case "clear":
        return await clearAllTodos(ctx);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
});

async function createTodos(ctx: any) {
  const { logger, deployer, args, currentSigner } = ctx;
  const count = args.count || 1;
  const baseTitle = args.title || "Todo";

  logger.info(`📝 Creating ${count} todo(s)...`);

  const results = [];
  for (let i = 0; i < count; i++) {
    const todoId = `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const title = count > 1 ? `${baseTitle} ${i + 1}` : baseTitle;

    const tx = deployer
      .execution(`(free.todos.create-todo "${todoId}" "${title}")`)
      .withChainId(ctx.chainId as any)
      .withSigner(currentSigner?.account || "")
      .withGasLimit(10000)
      .withGasPrice(0.00001);

    const result = await tx.build().execute();
    await deployer.waitForTransaction(result.requestKey);

    logger.success(`✅ Created todo: ${todoId} - "${title}"`);
    results.push({ id: todoId, title });
  }

  return {
    action: "create",
    count: results.length,
    todos: results,
  };
}

async function toggleTodo(ctx: any) {
  const { logger, deployer, args, currentSigner } = ctx;

  if (!args.id) {
    throw new Error("Todo ID is required for toggle action");
  }

  logger.info(`🔄 Toggling todo: ${args.id}`);

  // First get the current state
  const getTx = deployer
    .execution(`(free.todos.get-todo "${args.id}")`)
    .withChainId(ctx.chainId as any);

  const currentTodo = await getTx.build().dirtyRead();
  const currentState = currentTodo.result?.completed || false;

  // Toggle the todo
  const tx = deployer
    .execution(`(free.todos.toggle-todo "${args.id}")`)
    .withChainId(ctx.chainId as any)
    .withSigner(currentSigner?.account || "")
    .withGasLimit(10000)
    .withGasPrice(0.00001);

  const result = await tx.build().execute();
  await deployer.waitForTransaction(result.requestKey);

  logger.success(`✅ Toggled todo ${args.id}: ${currentState} → ${!currentState}`);

  return {
    action: "toggle",
    id: args.id,
    previousState: currentState,
    newState: !currentState,
  };
}

async function updateTodo(ctx: any) {
  const { logger, deployer, args, currentSigner } = ctx;

  if (!args.id || !args.title) {
    throw new Error("Both ID and title are required for update action");
  }

  logger.info(`✏️ Updating todo ${args.id}: "${args.title}"`);

  const tx = deployer
    .execution(`(free.todos.update-todo "${args.id}" "${args.title}")`)
    .withChainId(ctx.chainId as any)
    .withSigner(currentSigner?.account || "")
    .withGasLimit(10000)
    .withGasPrice(0.00001);

  const result = await tx.build().execute();
  await deployer.waitForTransaction(result.requestKey);

  logger.success(`✅ Updated todo ${args.id}`);

  return {
    action: "update",
    id: args.id,
    title: args.title,
  };
}

async function deleteTodo(ctx: any) {
  const { logger, deployer, args, currentSigner } = ctx;

  if (!args.id) {
    throw new Error("Todo ID is required for delete action");
  }

  logger.info(`🗑️ Deleting todo: ${args.id}`);

  const tx = deployer
    .execution(`(free.todos.delete-todo "${args.id}")`)
    .withChainId(ctx.chainId as any)
    .withSigner(currentSigner?.account || "")
    .withGasLimit(10000)
    .withGasPrice(0.00001);

  const result = await tx.build().execute();
  await deployer.waitForTransaction(result.requestKey);

  logger.success(`✅ Deleted todo ${args.id}`);

  return {
    action: "delete",
    id: args.id,
  };
}

async function listTodos(ctx: any) {
  const { logger, deployer } = ctx;

  logger.info("📋 Fetching all todos...");

  const tx = deployer
    .execution(`(free.todos.all-todos)`)
    .withChainId(ctx.chainId as any);

  try {
    const result = await tx.build().dirtyRead();
    const todos = result.result || [];

    if (todos.length === 0) {
      logger.info("📭 No todos found");
    } else {
      logger.info(`📝 Found ${todos.length} todo(s):`);
      todos.forEach((todo: any, index: number) => {
        const status = todo.completed ? "✅" : "⬜";
        const deleted = todo.deleted ? " [DELETED]" : "";
        logger.info(`  ${index + 1}. ${status} ${todo.title} (${todo.id})${deleted}`);
      });
    }

    return {
      action: "list",
      count: todos.length,
      todos,
    };
  } catch (error) {
    logger.warn("Could not fetch todos. The contract might not be deployed yet.");
    return {
      action: "list",
      count: 0,
      todos: [],
      error: "Contract not deployed or function not available",
    };
  }
}

async function clearAllTodos(ctx: any) {
  const { logger, deployer } = ctx;

  logger.info("🧹 Clearing all todos...");

  // First get all todos
  const listResult = await listTodos(ctx);
  const todos = listResult.todos || [];

  if (todos.length === 0) {
    logger.info("No todos to clear");
    return {
      action: "clear",
      cleared: 0,
    };
  }

  // Delete each todo
  let cleared = 0;
  for (const todo of todos) {
    if (!todo.deleted) {
      await deleteTodo({ ...ctx, args: { ...ctx.args, id: todo.id } });
      cleared++;
    }
  }

  logger.success(`✅ Cleared ${cleared} todo(s)`);

  return {
    action: "clear",
    cleared,
  };
}