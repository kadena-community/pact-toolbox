# @pact-toolbox/ui-shared

Shared UI components and styles for Pact Toolbox using Lit web components. This package provides a consistent design system for building user interfaces across the Pact Toolbox ecosystem.

## Installation

```bash
npm install @pact-toolbox/ui-shared
```

## Features

- 🎨 **Themeable**: Built-in light, dark, and auto theme support
- 🧩 **Web Components**: Framework-agnostic components built with Lit
- 📦 **Zero Dependencies**: Only depends on Lit for maximum compatibility
- 🎯 **TypeScript Support**: Full TypeScript definitions included
- ⚡ **Performance**: Optimized for small bundle size and fast rendering
- 🌐 **CSS Custom Properties**: Extensive customization through CSS variables

## Quick Start

### 1. Import Components

```typescript
import "@pact-toolbox/ui-shared";
// Or import specific components
import { PactButton, PactCard, PactModal } from "@pact-toolbox/ui-shared";
```

### 2. Use Theme Provider

Wrap your application with the theme provider to enable theming:

```html
<pact-theme-provider theme="light">
  <your-app></your-app>
</pact-theme-provider>
```

### 3. Use Components

```html
<pact-button variant="primary" size="md"> Click Me </pact-button>

<pact-card>
  <h2>Card Title</h2>
  <p>Card content goes here</p>
</pact-card>
```

## Components

### PactButton

A versatile button component with multiple variants and states.

```html
<pact-button variant="primary" size="md" @click="${handleClick}"> Primary Button </pact-button>

<pact-button variant="secondary" loading> Loading... </pact-button>

<pact-button variant="danger" disabled> Disabled </pact-button>
```

**Props:**

- `variant`: `"primary" | "secondary" | "ghost" | "danger"` (default: "primary")
- `size`: `"sm" | "md" | "lg"` (default: "md")
- `disabled`: `boolean` (default: false)
- `loading`: `boolean` (default: false)
- `type`: `"button" | "submit" | "reset"` (default: "button")
- `fullWidth`: `boolean` (default: false)

### PactCard

A container component for grouping related content.

```html
<pact-card>
  <h3>Card Title</h3>
  <p>Card content with automatic padding and shadow</p>
</pact-card>
```

### PactModal

A modal dialog component for overlays.

```html
<pact-modal open @close="${handleClose}">
  <h2 slot="header">Modal Title</h2>
  <p>Modal content goes here</p>
  <div slot="footer">
    <pact-button @click="${handleClose}">Close</pact-button>
  </div>
</pact-modal>
```

**Props:**

- `open`: `boolean` (default: false)

**Events:**

- `close`: Fired when the modal requests to be closed

### PactBadge

A badge component for labels and status indicators.

```html
<pact-badge variant="success">Active</pact-badge> <pact-badge variant="error" size="sm">Error</pact-badge>
```

**Props:**

- `variant`: `"default" | "primary" | "success" | "error" | "warning"` (default: "default")
- `size`: `"sm" | "md"` (default: "md")

### PactAvatar

An avatar component for user profiles.

```html
<pact-avatar name="John Doe" size="md"></pact-avatar> <pact-avatar src="/avatar.jpg" size="lg"></pact-avatar>
```

**Props:**

- `src`: `string` - Image URL
- `name`: `string` - Name for initials fallback
- `size`: `"sm" | "md" | "lg"` (default: "md")

### PactInput

An input field component with consistent styling.

```html
<pact-input type="text" placeholder="Enter text" value="${value}" @input="${handleInput}"></pact-input>

<pact-input type="email" error="Invalid email" disabled></pact-input>
```

**Props:**

- `type`: `string` (default: "text")
- `value`: `string`
- `placeholder`: `string`
- `disabled`: `boolean` (default: false)
- `readonly`: `boolean` (default: false)
- `error`: `string` - Error message to display

### PactSpinner

A loading spinner component.

```html
<pact-spinner></pact-spinner> <pact-spinner size="24"></pact-spinner>
```

**Props:**

- `size`: `number` (default: 20) - Size in pixels

## Theming

### Theme Provider

The theme provider component sets CSS custom properties for all child components:

```html
<!-- Light theme -->
<pact-theme-provider theme="light">
  <your-app></your-app>
</pact-theme-provider>

<!-- Dark theme -->
<pact-theme-provider theme="dark">
  <your-app></your-app>
</pact-theme-provider>

<!-- Auto theme (follows system preference) -->
<pact-theme-provider theme="auto">
  <your-app></your-app>
</pact-theme-provider>
```

### CSS Custom Properties

The theme provider exposes numerous CSS custom properties for customization:

#### Colors

- `--pact-color-primary`: Primary brand color
- `--pact-color-secondary`: Secondary brand color
- `--pact-color-success`: Success state color
- `--pact-color-error`: Error state color
- `--pact-color-warning`: Warning state color
- `--pact-color-bg-primary`: Primary background
- `--pact-color-text-primary`: Primary text color

#### Spacing

- `--pact-spacing-xs`: 0.25rem
- `--pact-spacing-sm`: 0.5rem
- `--pact-spacing-md`: 1rem
- `--pact-spacing-lg`: 1.5rem
- `--pact-spacing-xl`: 2rem

#### Typography

- `--pact-font-family`: System font stack
- `--pact-font-size-base`: 1rem
- `--pact-font-weight-medium`: 500
- `--pact-line-height-normal`: 1.5

#### Borders & Shadows

- `--pact-border-radius-base`: 0.5rem
- `--pact-shadow-base`: Standard shadow
- `--pact-shadow-lg`: Large shadow

### Customizing Theme

Override CSS custom properties to customize the theme:

```css
pact-theme-provider {
  --pact-color-primary: #007bff;
  --pact-color-primary-hover: #0056b3;
  --pact-font-family: "Inter", sans-serif;
  --pact-border-radius-base: 0.25rem;
}
```

## Styling Components

### Using Parts

Components expose parts for advanced styling:

```css
pact-button::part(button) {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

### Global Styles

Import base styles and animations:

```typescript
import { baseStyles, animations } from "@pact-toolbox/ui-shared/styles";
```

## TypeScript Support

All components include TypeScript definitions:

```typescript
import type { ButtonVariant, ButtonSize, BadgeVariant, AvatarSize } from "@pact-toolbox/ui-shared";
```

## Framework Integration

While these are web components that work with any framework, here are some integration tips:

### React

```tsx
import "@pact-toolbox/ui-shared";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "pact-button": any;
      "pact-card": any;
      // ... other components
    }
  }
}

function App() {
  return (
    <pact-theme-provider theme="light">
      <pact-button variant="primary">Click Me</pact-button>
    </pact-theme-provider>
  );
}
```

### Vue

```vue
<template>
  <pact-theme-provider theme="light">
    <pact-button variant="primary" @click="handleClick"> Click Me </pact-button>
  </pact-theme-provider>
</template>

<script setup>
import "@pact-toolbox/ui-shared";

const handleClick = () => {
  console.log("Clicked!");
};
</script>
```

## Development

### Building

```bash
pnpm build
```

### Testing

```bash
pnpm test
pnpm test:watch
```

### Development Mode

```bash
pnpm dev
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Requires native Web Components support

## License

MIT
