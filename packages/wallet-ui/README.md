# @pact-toolbox/wallet-ui

Cross-framework wallet UI components for pact-toolbox. Provides a wallet selection modal for connecting to various Kadena wallets.

## Features

- 🎨 **Cross-Framework**: Works with React, Vue, Angular, and vanilla JavaScript
- 🔌 **Auto-Connect**: Support for automatic wallet connection
- 🎯 **Web Components**: Built with LitElement for true framework independence
- 🌙 **Theme Support**: Light/dark themes with CSS variables

## Installation

```bash
npm install @pact-toolbox/wallet-ui
```

## Quick Start

### Vanilla JavaScript

```javascript
import { ModalManager } from "@pact-toolbox/wallet-ui";

// Initialize modal manager
const modalManager = ModalManager.getInstance();
modalManager.initialize();

// Show wallet selector
const walletId = await modalManager.showWalletSelector();
if (walletId) {
  await modalManager.connectWallet(walletId);
}
```

### React

```tsx
import { WalletModalProvider, ConnectWalletButton } from "@pact-toolbox/wallet-ui/react";

function App() {
  return (
    <WalletModalProvider>
      <ConnectWalletButton onConnect={(walletId) => console.log("Connected:", walletId)} />
      {/* Your app components */}
    </WalletModalProvider>
  );
}
```

### Vue

```vue
<script setup>
import { provideWalletModal, useWalletSelector } from "@pact-toolbox/wallet-ui/vue";

// In root component
provideWalletModal();

// In any child component
const { openSelector, isOpen, error } = useWalletSelector();

const connectWallet = async () => {
  const walletId = await openSelector();
  if (walletId) {
    console.log("Connected:", walletId);
  }
};
</script>

<template>
  <button @click="connectWallet" :disabled="isOpen">
    {{ isOpen ? "Connecting..." : "Connect Wallet" }}
  </button>
</template>
```

### Angular

```typescript
import { Component } from "@angular/core";
import { WalletModalService, ConnectWalletComponent } from "@pact-toolbox/wallet-ui/angular";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [ConnectWalletComponent],
  template: `
    <pact-connect-wallet (connected)="onWalletConnected($event)" (connectionError)="onError($event)" />
    <p>Wallet Open: {{ walletModal.isOpen() }}</p>
    <p>Current Theme: {{ walletModal.theme() }}</p>
  `,
})
export class AppComponent {
  constructor(public walletModal: WalletModalService) {
    // Initialize with options
    walletModal.initialize({
      modalOptions: { theme: "dark" },
    });
  }

  onWalletConnected(walletId: string) {
    console.log("Connected:", walletId);
  }

  onError(error: Error) {
    console.error("Connection failed:", error);
  }
}
```

## Components

### Web Components

All components are registered automatically when you import the package:

- `<pact-wallet-modal>` - Base modal container
- `<pact-wallet-selector>` - Wallet selection grid
- `<pact-wallet-connect>` - Connect wallet button

### Modal Manager

The `ModalManager` class provides programmatic control:

```javascript
import { ModalManager } from "@pact-toolbox/wallet-ui";

const modalManager = ModalManager.getInstance();

// Initialize the modal manager
modalManager.initialize();

// Show wallet selector
const walletId = await modalManager.showWalletSelector();

// Connect to a wallet
const success = await modalManager.connectWallet(walletId);

// Set theme
modalManager.setTheme("dark");

// Cleanup when done
modalManager.cleanup();
```

## Framework Adapters

### React

```tsx
import {
  WalletModalProvider,
  useWalletModal,
  ConnectWalletButton,
  AutoConnectWallet,
} from "@pact-toolbox/wallet-ui/react";

// Provider setup
function App() {
  return (
    <WalletModalProvider modalOptions={{ theme: "dark" }}>
      <YourApp />
    </WalletModalProvider>
  );
}

// Using the hook
function YourComponent() {
  const { showWalletSelector, setTheme } = useWalletModal();

  const handleConnect = async () => {
    const walletId = await showWalletSelector();
    console.log("Selected:", walletId);
  };

  return <button onClick={handleConnect}>Connect</button>;
}
```

## Theming

Customize the appearance with CSS variables. The components use the theme system from `@pact-toolbox/ui-shared`:

```css
/* Light theme (default) */
[data-theme="light"] {
  --pact-bg-primary: #ffffff;
  --pact-text-primary: #000000;
  --pact-brand-primary: #0066cc;
  /* ... see @pact-toolbox/ui-shared for all variables */
}

/* Dark theme */
[data-theme="dark"] {
  --pact-bg-primary: #1e293b;
  --pact-text-primary: #f1f5f9;
  --pact-brand-primary: #60a5fa;
}
```

## Advanced Usage

### Custom Modal Container

```javascript
const modalManager = new ModalManager({
  containerId: "my-modal-root",
  theme: "dark",
});
```

### Manual Wallet Connection

```javascript
const modalManager = ModalManager.getInstance();

// Show selector
const walletId = await modalManager.showWalletSelector();

// Connect
if (walletId) {
  const success = await modalManager.connectWallet(walletId);
  if (success) {
    console.log("Connected successfully");
  }
}
```

## Browser Support

- Chrome/Edge 89+
- Firefox 63+
- Safari 14+

For older browsers, include the Web Components polyfill:

```html
<script src="https://unpkg.com/@webcomponents/webcomponentsjs@2.8.0/webcomponents-loader.js"></script>
```

## License

MIT
