/**
 * Test utilities for wallet-react package
 * Provides mock implementations and test helpers
 */

import React, { type ReactNode } from 'react';
import { vi } from 'vitest';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type {
  Wallet,
  WalletAccount,
  WalletNetwork,
  WalletMetadata,
  WalletEvents,
  WalletManagerEvents,
  ConnectOptions
} from '@pact-toolbox/wallet-core';
import type { WalletManager, WalletManagerConfig } from '@pact-toolbox/wallet-manager';
import { WalletManagerProvider, type WalletManagerProviderProps, useWalletContext } from './context';

/**
 * Mock wallet account data
 */
export const mockWalletAccount: WalletAccount = {
  address: 'k:abc123def456789',
  balance: 100.5,
  publicKey: 'abc123def456789',
  connectedAt: new Date('2024-01-01T10:00:00Z'),
};

/**
 * Mock wallet network data
 */
export const mockWalletNetwork: WalletNetwork = {
  id: 'development',
  name: 'Development Network',
  networkId: 'development',
  url: 'https://localhost:8080',
  isDefault: true,
};

/**
 * Mock wallet metadata
 */
export const mockWalletMetadata: WalletMetadata = {
  id: 'test-wallet',
  name: 'Test Wallet',
  type: 'browser-extension',
  description: 'A test wallet for unit testing',
  icon: 'data:image/svg+xml;base64,test-icon',
};

/**
 * Mock additional wallet metadata
 */
export const mockWalletMetadata2: WalletMetadata = {
  id: 'test-wallet-2',
  name: 'Test Wallet 2',
  type: 'mobile',
  description: 'Another test wallet',
  icon: 'data:image/svg+xml;base64,test-icon-2',
};

/**
 * Create a mock wallet instance
 */
export function createMockWallet(overrides?: Partial<Wallet>): Wallet {
  const baseWallet: Wallet = {
    id: 'test-wallet',

    // Event emitter methods
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),

    // Core wallet methods
    isInstalled: vi.fn().mockReturnValue(true),
    connect: vi.fn().mockResolvedValue(mockWalletAccount),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getAccount: vi.fn().mockResolvedValue(mockWalletAccount),
    getNetwork: vi.fn().mockResolvedValue(mockWalletNetwork),
    isConnected: vi.fn().mockResolvedValue(true),

    // Optional multi-account/network methods
    getAccounts: vi.fn().mockResolvedValue([mockWalletAccount]),
    getNetworks: vi.fn().mockResolvedValue([mockWalletNetwork]),

    // Transaction methods
    sign: vi.fn().mockResolvedValue({ signatures: [] }),

    ...overrides,
  };

  return baseWallet;
}

/**
 * Create a mock wallet manager instance
 */
export function createMockWalletManager(overrides?: Partial<WalletManager>): WalletManager {
  const connectedWallets: Wallet[] = [];
  const availableWallets: WalletMetadata[] = [mockWalletMetadata, mockWalletMetadata2];
  let primaryWallet: Wallet | null = null;

  const baseManager = {
    // Event emitter methods
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),

    // Initialization
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),

    // Wallet management
    connect: vi.fn().mockImplementation(async (options?: ConnectOptions) => {
      const wallet = createMockWallet({
        id: options?.walletId || 'test-wallet',
        isConnected: vi.fn().mockResolvedValue(true)
      });
      connectedWallets.push(wallet);
      if (!primaryWallet) {
        primaryWallet = wallet;
      }
      return wallet;
    }),

    disconnect: vi.fn().mockImplementation(async (walletId?: string) => {
      const index = connectedWallets.findIndex(w => !walletId || w.id === walletId);
      if (index >= 0) {
        const wallet = connectedWallets[index];
        connectedWallets.splice(index, 1);
        if (wallet === primaryWallet) {
          primaryWallet = connectedWallets[0] || null;
        }
      }
    }),

    getConnectedWallets: vi.fn().mockImplementation(() => [...connectedWallets]),
    getPrimaryWallet: vi.fn().mockImplementation(() => primaryWallet),
    setPrimaryWallet: vi.fn().mockImplementation((wallet: Wallet | string) => {
      if (typeof wallet === 'string') {
        const found = connectedWallets.find(w => w.id === wallet);
        if (found) primaryWallet = found;
      } else {
        primaryWallet = wallet;
      }
    }),

    getAvailableWallets: vi.fn().mockReturnValue(availableWallets),

    // Auto-connect
    autoConnect: vi.fn().mockResolvedValue([]),

    ...overrides,
  };

  return baseManager as unknown as WalletManager;
}

/**
 * Enhanced render function with wallet manager provider
 */
interface WalletRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  walletManager?: WalletManager;
  walletManagerProps?: Partial<WalletManagerProviderProps>;
}

export function renderWithWalletProvider(
  ui: ReactNode,
  options: WalletRenderOptions = {}
): RenderResult {
  const { walletManager, walletManagerProps = {}, ...renderOptions } = options;

  const TestWrapper = ({ children }: { children: ReactNode }) => (
    <WalletManagerProvider
      walletManager={walletManager || createMockWalletManager()}
      autoInitialize={true}
      {...walletManagerProps}
    >
      {children}
    </WalletManagerProvider>
  );

  return render(
    <TestWrapper>{ui}</TestWrapper>,
    renderOptions
  );
}

/**
 * Create wrapper component for renderHook tests
 */
export function createWalletWrapper(options: WalletRenderOptions = {}): ({ children }: { children: ReactNode }) => React.JSX.Element {
  const { walletManager, walletManagerProps = {} } = options;

  return ({ children }: { children: ReactNode }) => (
    <WalletManagerProvider
      walletManager={walletManager || createMockWalletManager()}
      autoInitialize={true}
      {...walletManagerProps}
    >
      {children}
    </WalletManagerProvider>
  );
}

/**
 * Create wrapper component for renderHook tests with pre-initialized state
 */
export function createWalletWrapperWithState(options: WalletRenderOptions & {
  connectedWallets?: Wallet[];
  primaryWallet?: Wallet | null;
} = {}): ({ children }: { children: ReactNode }) => React.JSX.Element {
  const { walletManager, walletManagerProps = {}, connectedWallets = [], primaryWallet = null } = options;

  const manager = walletManager || createMockWalletManager();

  // Set up mock state immediately
  if (connectedWallets.length > 0) {
    manager.getConnectedWallets = vi.fn().mockReturnValue(connectedWallets);
  }
  if (primaryWallet !== undefined) {
    manager.getPrimaryWallet = vi.fn().mockReturnValue(primaryWallet);
  }

  return ({ children }: { children: ReactNode }) => (
    <WalletManagerProvider
      walletManager={manager}
      autoInitialize={true}
      {...walletManagerProps}
    >
      {children}
    </WalletManagerProvider>
  );
}

/**
 * Create a simple test wrapper that directly provides pre-set context state
 * This bypasses the async initialization issues for simpler testing
 */
export function createSimpleTestWrapper(state: {
  connectedWallets?: Wallet[];
  primaryWallet?: Wallet | null;
  availableWallets?: WalletMetadata[];
} = {}): ({ children }: { children: ReactNode }) => React.JSX.Element {
  const {
    connectedWallets = [],
    primaryWallet = null,
    availableWallets = [mockWalletMetadata, mockWalletMetadata2]
  } = state;

  // Create a simplified mock manager that returns the state directly
  const mockManager = createMockWalletManager({
    getPrimaryWallet: vi.fn().mockReturnValue(primaryWallet),
    getConnectedWallets: vi.fn().mockReturnValue(connectedWallets),
    getAvailableWallets: vi.fn().mockReturnValue(availableWallets),
    initialize: vi.fn().mockResolvedValue(undefined),
  });

  return ({ children }: { children: ReactNode }) => (
    <WalletManagerProvider
      walletManager={mockManager}
      autoInitialize={false}  // We'll initialize synchronously
    >
      <TestStateInjector
        connectedWallets={connectedWallets}
        primaryWallet={primaryWallet}
        availableWallets={availableWallets}
      >
        {children}
      </TestStateInjector>
    </WalletManagerProvider>
  );
}

/**
 * Component that directly injects state into context for testing
 */
function TestStateInjector({
  children,
  connectedWallets,
  primaryWallet,
  availableWallets
}: {
  children: ReactNode;
  connectedWallets: Wallet[];
  primaryWallet: Wallet | null;
  availableWallets: WalletMetadata[];
}): React.JSX.Element {
  const context = useWalletContext();

  // Directly manipulate the context state for testing
  React.useEffect(() => {
    // Force update the context state synchronously
    // This is a hack for testing but allows us to bypass async initialization
    (context as any).walletManager = createMockWalletManager({
      getPrimaryWallet: vi.fn().mockReturnValue(primaryWallet),
      getConnectedWallets: vi.fn().mockReturnValue(connectedWallets),
      getAvailableWallets: vi.fn().mockReturnValue(availableWallets),
    });
    (context as any).isInitialized = true;
    (context as any).connectedWallets = connectedWallets;
    (context as any).primaryWallet = primaryWallet;
    (context as any).availableWallets = availableWallets;
  }, [context, connectedWallets, primaryWallet, availableWallets]);

  return <>{children}</>;
}

/**
 * Render function without wallet provider (for testing error cases)
 */
export function renderWithoutProvider(ui: ReactNode, options?: RenderOptions): RenderResult {
  return render(ui, options);
}

/**
 * Create a mock wallet manager with specific state
 */
export function createMockWalletManagerWithState(state: {
  isInitialized?: boolean;
  isInitializing?: boolean;
  initError?: Error | null;
  connectedWallets?: Wallet[];
  primaryWallet?: Wallet | null;
  availableWallets?: WalletMetadata[];
}): WalletManager {
  const manager = createMockWalletManager();

  // Override methods to return specific state
  if (state.isInitialized !== undefined) {
    manager.isInitialized = vi.fn().mockReturnValue(state.isInitialized);
  }

  if (state.connectedWallets !== undefined) {
    manager.getConnectedWallets = vi.fn().mockReturnValue(state.connectedWallets);
  }

  if (state.primaryWallet !== undefined) {
    manager.getPrimaryWallet = vi.fn().mockReturnValue(state.primaryWallet);
  }

  if (state.availableWallets !== undefined) {
    manager.getAvailableWallets = vi.fn().mockReturnValue(state.availableWallets);
  }

  // Handle initialization error
  if (state.initError) {
    manager.initialize = vi.fn().mockRejectedValue(state.initError);
  }

  return manager;
}

/**
 * Wait for async effects to complete
 */
export const waitForAsync = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Mock wallet event emitter
 */
export function mockWalletEvents(wallet: Wallet): {
  emitConnected: () => void;
  emitDisconnected: () => void;
  emitAccountChanged: (account: WalletAccount) => void;
  emitNetworkChanged: (network: WalletNetwork) => void;
  emitError: (error: Error) => void;
} {
  const listeners = new Map<string, Function[]>();

  wallet.on = vi.fn().mockImplementation((event: string, listener: Function) => {
    if (!listeners.has(event)) {
      listeners.set(event, []);
    }
    listeners.get(event)?.push(listener);
  });

  wallet.off = vi.fn().mockImplementation((event: string, listener: Function) => {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index >= 0) {
        eventListeners.splice(index, 1);
      }
    }
  });

  const emit = (event: string, ...args: any[]) => {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
    }
  };

  return {
    emitConnected: () => emit('connected', wallet),
    emitDisconnected: () => emit('disconnected', wallet),
    emitAccountChanged: (account: WalletAccount) => emit('accountChanged', account),
    emitNetworkChanged: (network: WalletNetwork) => emit('networkChanged', network),
    emitError: (error: Error) => emit('error', error),
  };
}

/**
 * Mock wallet manager event emitter
 */
export function mockWalletManagerEvents(manager: WalletManager): {
  emitConnected: (wallet: Wallet) => void;
  emitDisconnected: (wallet: Wallet) => void;
  emitPrimaryWalletChanged: (wallet: Wallet) => void;
  emitAccountChanged: (account: WalletAccount) => void;
  emitNetworkChanged: (network: WalletNetwork) => void;
  emitError: (error: Error) => void;
} {
  const listeners = new Map<string, Function[]>();

  manager.on = vi.fn().mockImplementation((event: string, listener: Function) => {
    if (!listeners.has(event)) {
      listeners.set(event, []);
    }
    listeners.get(event)?.push(listener);
  });

  manager.off = vi.fn().mockImplementation((event: string, listener: Function) => {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index >= 0) {
        eventListeners.splice(index, 1);
      }
    }
  });

  const emit = (event: string, ...args: any[]) => {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
    }
  };

  return {
    emitConnected: (wallet: Wallet) => emit('connected', wallet),
    emitDisconnected: (wallet: Wallet) => emit('disconnected', wallet),
    emitPrimaryWalletChanged: (wallet: Wallet) => emit('primaryWalletChanged', wallet),
    emitAccountChanged: (account: WalletAccount) => emit('accountChanged', account),
    emitNetworkChanged: (network: WalletNetwork) => emit('networkChanged', network),
    emitError: (error: Error) => emit('error', error),
  };
}

/**
 * Async event helpers for testing
 */
export const asyncEvents = {
  connected: (manager: WalletManager, wallet: Wallet): void => {
    setTimeout(() => {
      const events = mockWalletManagerEvents(manager);
      events.emitConnected(wallet);
    }, 0);
  },

  disconnected: (manager: WalletManager, wallet: Wallet): void => {
    setTimeout(() => {
      const events = mockWalletManagerEvents(manager);
      events.emitDisconnected(wallet);
    }, 0);
  },

  primaryWalletChanged: (manager: WalletManager, wallet: Wallet): void => {
    setTimeout(() => {
      const events = mockWalletManagerEvents(manager);
      events.emitPrimaryWalletChanged(wallet);
    }, 0);
  },

  accountChanged: (manager: WalletManager, account: WalletAccount): void => {
    setTimeout(() => {
      const events = mockWalletManagerEvents(manager);
      events.emitAccountChanged(account);
    }, 0);
  },

  networkChanged: (manager: WalletManager, network: WalletNetwork): void => {
    setTimeout(() => {
      const events = mockWalletManagerEvents(manager);
      events.emitNetworkChanged(network);
    }, 0);
  },

  error: (manager: WalletManager, error: Error): void => {
    setTimeout(() => {
      const events = mockWalletManagerEvents(manager);
      events.emitError(error);
    }, 0);
  },
};