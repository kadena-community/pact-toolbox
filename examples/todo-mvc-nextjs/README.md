# Todo MVC - Next.js with Pact Toolbox

This is a Todo MVC application built with Next.js and Pact Toolbox, demonstrating how to integrate Pact smart contracts with a modern Next.js application.

## Features

- ✅ Full CRUD operations for todos
- ✅ Real-time contract interaction with Pact blockchain
- ✅ Type-safe contract calls with auto-generated TypeScript types
- ✅ Modern UI with Tailwind CSS
- ✅ Optimistic updates with React Query
- ✅ Hot module replacement for Pact contracts

## Getting Started

### Prerequisites

- Node.js 22.0.0 or later
- pnpm package manager

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Start the development server:
```bash
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
todo-mvc-nextjs/
├── pact/                    # Pact smart contracts
│   ├── todos.pact          # Todo contract implementation
│   └── todos.repl          # Contract tests
├── src/
│   ├── app/                # Next.js App Router pages
│   ├── api/                # Pact contract API integration
│   └── components/         # React components
├── next.config.js          # Next.js configuration with Pact plugin
└── pact-toolbox.config.ts  # Pact Toolbox configuration
```

## Development Workflow

1. **Contract Development**: Edit `.pact` files in the `pact/` directory
2. **Type Generation**: Types are automatically generated when contracts change
3. **Hot Reload**: The app automatically reloads when contracts are modified
4. **Testing**: Run contract tests with `pnpm test`

## Key Technologies

- **Next.js 15**: React framework with App Router
- **Pact Toolbox**: Smart contract development toolkit
- **React Query**: Data fetching and caching
- **Tailwind CSS**: Utility-first CSS framework
- **TypeScript**: Type-safe development

## Contract Interface

The Todo contract provides the following functions:

- `create-todo`: Create a new todo item
- `get-todos`: Retrieve all todos
- `get-todo`: Get a specific todo by ID
- `toggle-todo`: Toggle todo completion status
- `update-todo`: Update todo title
- `delete-todo`: Soft delete a todo

## Configuration

The app uses the Pact Toolbox Next.js plugin which:
- Automatically starts a local Pact development network
- Compiles Pact contracts on changes
- Generates TypeScript types from contracts
- Configures webpack/turbopack for `.pact` file imports

## Learn More

- [Pact Toolbox Documentation](https://github.com/kadena-community/pact-toolbox)
- [Next.js Documentation](https://nextjs.org/docs)

---

Made with ❤️ by [@salamaashoush](https://github.com/salamaashoush)