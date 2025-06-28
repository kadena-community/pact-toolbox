import { vi } from 'vitest';

// Mock Web Crypto API
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
        arr[i] = Math.floor(Math.random() * 256) as any;
      }
      return arr;
    }),
  },
});

// Mock TextEncoder/TextDecoder if not available
if (typeof TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = class {
    encode(str: string): Uint8Array {
      const buf = Buffer.from(str, 'utf8');
      const arr = new Uint8Array(buf.length);
      for (let i = 0; i < buf.length; i++) {
        arr[i] = buf[i]!;
      }
      return arr;
    }
  };
}

if (typeof TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = class {
    decode(arr: Uint8Array): string {
      return Buffer.from(arr).toString('utf8');
    }
  };
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock CustomEvent if not available
if (typeof CustomEvent === 'undefined') {
  (globalThis as any).CustomEvent = class CustomEvent extends Event {
    detail: any;
    constructor(type: string, eventInitDict?: CustomEventInit) {
      super(type, eventInitDict);
      this.detail = eventInitDict?.detail;
    }
  };
}

// Mock document for event testing
export const mockDocument = {
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Override document in tests
if (typeof document !== 'undefined') {
  Object.assign(document, mockDocument);
}

// Add beforeEach hook to clear mocks
beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// Export all test helpers
export * from './test-helpers';