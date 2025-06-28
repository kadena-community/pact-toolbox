# Pact Toolbox Documentation

This is the documentation site for Pact Toolbox, built with [RSPress](https://rspress.dev/).

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Project Structure

```
docs/
├── docs/                 # Documentation content
│   ├── index.md         # Landing page
│   ├── intro.md         # Introduction
│   ├── getting-started/ # Getting started guides
│   ├── api/            # API reference (auto-generated)
│   └── ...
├── generate-api.cjs     # API documentation generator
├── rspress.config.ts    # RSPress configuration
└── package.json
```

## API Documentation

API documentation is automatically generated from TypeScript source files using TypeDoc:

```bash
# Generate API docs only
pnpm build:api

# Build everything (includes API generation)
pnpm build
```

## Deployment

The documentation is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

### Manual Deployment

1. Enable GitHub Pages in your repository settings:
   - Go to Settings → Pages
   - Under "Build and deployment", select "GitHub Actions" as the source

2. The workflow will automatically run on pushes to `main` that modify docs

3. You can also manually trigger deployment:
   - Go to Actions → Deploy Docs to GitHub Pages
   - Click "Run workflow"

The site will be available at: `https://[username].github.io/pact-toolbox/`

### Local Preview with GitHub Pages Base Path

To preview the site locally with the GitHub Pages base path:

```bash
GITHUB_PAGES=true pnpm build
pnpm preview
```

## Adding Content

1. **Markdown Pages**: Add `.md` files in the `docs/` directory
2. **Navigation**: Update `rspress.config.ts` to add new pages to the sidebar
3. **API Docs**: Will be regenerated automatically when building

## Configuration

- `rspress.config.ts` - Main configuration file
- `generate-api.cjs` - Configures which packages to include in API docs
- Environment variables:
  - `GITHUB_PAGES=true` - Builds with `/pact-toolbox/` base path