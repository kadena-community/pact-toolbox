/**
 * Test setup file for wallet-react package
 * Configures test environment and global mocks
 */

import { vi, beforeAll, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock console methods for cleaner test output
const originalError = console.error;
const originalWarn = console.warn;
const originalDebug = console.debug;

beforeAll(() => {
  // Mock console.error to suppress expected errors in tests
  console.error = vi.fn((...args) => {
    // Allow specific error messages for testing
    const message = args[0];
    if (typeof message === 'string' && (
      message.includes('useWalletContext must be used within a WalletManagerProvider') ||
      message.includes('Wallet manager not initialized') ||
      message.includes('Failed to refresh wallet state') ||
      message.includes('Wallet connection error')
    )) {
      return;
    }
    originalError(...args);
  });

  // Mock console.warn for warnings
  console.warn = vi.fn((...args) => {
    const message = args[0];
    if (typeof message === 'string' && (
      message.includes('deprecated') ||
      message.includes('warning')
    )) {
      return;
    }
    originalWarn(...args);
  });

  // Mock console.debug for debug messages
  console.debug = vi.fn((...args) => {
    const message = args[0];
    if (typeof message === 'string' && (
      message.includes('Multi-account not supported') ||
      message.includes('Multi-network not supported') ||
      message.includes('Failed to get wallet account/network')
    )) {
      return;
    }
    originalDebug(...args);
  });
});

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});

// Global test utilities
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords = vi.fn();

  constructor() {}
}

global.IntersectionObserver = MockIntersectionObserver as any;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});