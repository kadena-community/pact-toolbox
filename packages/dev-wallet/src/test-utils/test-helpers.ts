import { vi } from 'vitest';
import type { Account, Network } from '../ui/types';
import type { DevWalletSettings as Settings, DevWalletKey, DevWalletTransaction as Transaction } from '../types';

// Mock implementations
export const mockCrypto = {
  generateKeyPair: vi.fn().mockResolvedValue({
    publicKey: 'mock-public-key',
    secretKey: 'mock-secret-key',
  }),
  exportBase16Key: vi.fn().mockImplementation((key: any) => key),
};

// Browser mocks setup
export function setupBrowserMocks() {
  // Mock window.crypto
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      subtle: {
        generateKey: vi.fn().mockResolvedValue({
          privateKey: {},
          publicKey: {},
        }),
        exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        importKey: vi.fn().mockResolvedValue({}),
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
      getRandomValues: vi.fn((arr: any) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
    },
    configurable: true,
  });

  // Mock CustomEvent
  if (typeof CustomEvent === 'undefined') {
    (globalThis as any).CustomEvent = class CustomEvent extends Event {
      detail: any;
      constructor(type: string, eventInitDict?: CustomEventInit) {
        super(type, eventInitDict);
        this.detail = eventInitDict?.detail;
      }
    };
  }
}

export function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
}

// Timer utilities
let usingFakeTimers = false;

export function setupTimers() {
  if (!usingFakeTimers) {
    vi.useFakeTimers();
    usingFakeTimers = true;
  }
}

export function teardownTimers() {
  if (usingFakeTimers) {
    vi.useRealTimers();
    usingFakeTimers = false;
  }
}

export function advanceTimers(ms: number) {
  if (usingFakeTimers) {
    vi.advanceTimersByTime(ms);
  }
}

// Mock data factories
export function createMockAccount(overrides?: Partial<Account>): Account {
  return {
    address: 'k:mock-public-key',
    name: 'Test Account',
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
    chainId: '0',
    balance: 100.0,
    ...overrides,
  };
}

export function createMockTransaction(overrides?: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    hash: 'test-hash',
    from: 'k:mock-sender',
    to: 'k:mock-receiver',
    amount: 1.0,
    gas: 1000,
    status: 'pending',
    timestamp: Date.now(),
    chainId: '0',
    capability: 'coin.TRANSFER',
    data: {
      payload: { exec: { code: 'test-code', data: {} } },
      signers: [{ pubKey: 'mock-public-key' }],
      meta: { chainId: '0', sender: 'test-sender' },
      networkId: 'testnet04',
      nonce: 'test-nonce',
    },
    ...overrides,
  };
}

export function createMockSettings(overrides?: Partial<Settings>): Settings {
  return {
    autoLock: true,
    showTestNetworks: true,
    ...overrides,
  };
}

export function createMockNetwork(overrides?: Partial<Network>): Network {
  return {
    name: 'Testnet',
    id: 'testnet04',
    chainId: '0',
    rpcUrl: 'https://api.testnet.chainweb.com',
    explorerUrl: 'https://explorer.testnet.chainweb.com',
    ...overrides,
  };
}

export function createMockDevWalletKey(overrides?: Partial<DevWalletKey>): DevWalletKey {
  return {
    address: 'k:mock-public-key',
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
    name: 'Test Key',
    createdAt: Date.now(),
    ...overrides,
  };
}

// Async utilities
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timeout after ${timeout}ms`);
}

// Re-export all utilities
export * from './setup';