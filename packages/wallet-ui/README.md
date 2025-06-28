# @pact-toolbox/wallet-ui

Cross-framework wallet UI components for pact-toolbox. Automatically displays a wallet selection modal when signing transactions.

## Features

- 🎨 **Cross-Framework**: Works with React, Vue, Angular, and vanilla JavaScript
- 🔌 **Auto-Connect**: Automatically shows wallet selector when signing
- 🎯 **Web Components**: Built with LitElement for true framework independence  
- 🌙 **Theme Support**: Light/dark themes with CSS variables
- 🔐 **Transaction Approval**: Built-in UI for reviewing transactions
- 🧰 **Toolbox Wallet UI**: Key management interface for development wallet

## Installation

```bash
npm install @pact-toolbox/wallet-ui
```

## Quick Start

### Vanilla JavaScript

```javascript
import { ModalManager } from '@pact-toolbox/wallet-ui';

// Initialize modal manager
const modalManager = ModalManager.getInstance();
modalManager.initialize();

// Show wallet selector
const walletId = await modalManager.showWalletSelector();
if (walletId) {
  await modalManager.connectWallet(walletId);
}

// Or use with transaction builder (automatic UI in browser)
const tx = await transactionBuilder()
  .code('(coin.transfer "alice" "bob" 1.0)')
  .sign(); // Wallet UI appears automatically in browser!
```

### React

```tsx
import { WalletModalProvider, ConnectWalletButton } from '@pact-toolbox/wallet-ui/react';

function App() {
  return (
    <WalletModalProvider>
      <ConnectWalletButton onConnect={(walletId) => console.log('Connected:', walletId)} />
      {/* Your app components */}
    </WalletModalProvider>
  );
}
```

### Vue

```vue
<script setup>
import { provideWalletModal, useWalletSelector } from '@pact-toolbox/wallet-ui/vue';

// In root component
provideWalletModal();

// In any child component
const { openSelector, isOpen, error } = useWalletSelector();

const connectWallet = async () => {
  const walletId = await openSelector();
  if (walletId) {
    console.log('Connected:', walletId);
  }
};
</script>

<template>
  <button @click="connectWallet" :disabled="isOpen">
    {{ isOpen ? 'Connecting...' : 'Connect Wallet' }}
  </button>
</template>
```

### Angular

```typescript
import { Component } from '@angular/core';
import { WalletModalService, ConnectWalletComponent } from '@pact-toolbox/wallet-ui/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ConnectWalletComponent],
  template: `
    <pact-connect-wallet 
      (connected)="onWalletConnected($event)"
      (connectionError)="onError($event)"
    />
    <p>Wallet Open: {{ walletModal.isOpen() }}</p>
    <p>Current Theme: {{ walletModal.theme() }}</p>
  `
})
export class AppComponent {
  constructor(public walletModal: WalletModalService) {
    // Initialize with options
    walletModal.initialize({
      modalOptions: { theme: 'dark' }
    });
  }

  onWalletConnected(walletId: string) {
    console.log('Connected:', walletId);
  }

  onError(error: Error) {
    console.error('Connection failed:', error);
  }
}
```

## Components

### Web Components

All components are registered automatically when you import the package:

- `<pact-wallet-modal>` - Base modal container
- `<pact-wallet-selector>` - Wallet selection grid
- `<pact-transaction-approval>` - Transaction review UI
- `<pact-toolbox-wallet>` - Development wallet interface

### Modal Manager

The `ModalManager` class provides programmatic control:

```javascript
import { ModalManager } from '@pact-toolbox/wallet-ui';

const modalManager = ModalManager.getInstance();

// Show wallet selector
const walletId = await modalManager.showWalletSelector();

// Show transaction approval
const approved = await modalManager.showTransactionApproval(transaction);

// Show toolbox wallet UI
await modalManager.showToolboxWallet();
```

### Signing Interceptor

Automatically shows wallet UI when signing:

```javascript
import { SigningInterceptor } from '@pact-toolbox/wallet-ui';

// Install globally
SigningInterceptor.install({
  autoShowUI: true,      // Show wallet selector if not connected
  requireApproval: true  // Show transaction approval UI
});

// Uninstall when needed
SigningInterceptor.uninstall();
```

## Framework Adapters

### React

```tsx
import { 
  WalletModalProvider, 
  useWalletModal,
  ConnectWalletButton,
  AutoConnectWallet 
} from '@pact-toolbox/wallet-ui/react';

// Provider setup
function App() {
  return (
    <WalletModalProvider 
      autoInstallInterceptor={true}
      modalOptions={{ theme: 'dark' }}
    >
      <YourApp />
    </WalletModalProvider>
  );
}

// Using the hook
function YourComponent() {
  const { showWalletSelector, setTheme } = useWalletModal();
  
  const handleConnect = async () => {
    const walletId = await showWalletSelector();
    console.log('Selected:', walletId);
  };
  
  return <button onClick={handleConnect}>Connect</button>;
}
```

## Theming

Customize the appearance with CSS variables:

```css
/* Light theme (default) */
[data-theme="light"] {
  --pact-bg-primary: #ffffff;
  --pact-text-primary: #000000;
  --pact-brand-primary: #0066cc;
  /* ... see themes.ts for all variables */
}

/* Dark theme */
[data-theme="dark"] {
  --pact-bg-primary: #1e293b;
  --pact-text-primary: #f1f5f9;
  --pact-brand-primary: #60a5fa;
}
```

## Toolbox Wallet

The toolbox wallet UI now automatically reads keypairs from the global network context:

```javascript
// When using pact-toolbox with a network configuration
const network = createNetwork({
  networkId: 'testnet04',
  keyPairs: [
    {
      publicKey: 'abc123...',
      secretKey: 'def456...',
      account: 'k:abc123...'
    }
  ]
});

// The toolbox wallet will automatically load these keys
// They will appear in the wallet UI with a refresh button to reload from context
```

Features:
- Automatically loads keypairs from `__PACT_TOOLBOX_CONTEXT__.network`
- Refresh button to reload keys from network context
- Fallback to localStorage for persistence
- Generate new keys or import existing ones

## Advanced Usage

### Custom Modal Container

```javascript
const modalManager = new ModalManager({
  containerId: 'my-modal-root',
  theme: 'dark'
});
```

### Manual Wallet Connection

```javascript
const modalManager = ModalManager.getInstance();

// Show selector
const walletId = await modalManager.showWalletSelector();

// Connect
if (walletId) {
  await modalManager.connectWallet(walletId);
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