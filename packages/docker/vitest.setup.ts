import { vi } from 'vitest';

// Mock global fetch for health checks
global.fetch = vi.fn();

// Mock global setTimeout/clearTimeout for cleaner tests
global.setTimeout = vi.fn((callback) => {
  const id = Math.random();
  // Run callback synchronously in tests
  callback();
  return id;
});

global.clearTimeout = vi.fn();
global.setInterval = vi.fn((_callback, _interval) => {
  const id = Math.random();
  // Don't actually run intervals in tests by default
  return id;
});

global.clearInterval = vi.fn();