import { vi } from 'vitest';

// Mock global fetch for health checks
global.fetch = vi.fn();

// Mock global setTimeout/clearTimeout for cleaner tests
global.setTimeout = vi.fn((callback, delay) => {
  const id = Math.random();
  if (delay === 0) {
    callback();
  } else {
    // For non-zero delays, run callback after a short delay in tests
    setTimeout(callback, 10);
  }
  return id;
});

global.clearTimeout = vi.fn();
global.setInterval = vi.fn((callback, interval) => {
  const id = Math.random();
  // Don't actually run intervals in tests by default
  return id;
});

global.clearInterval = vi.fn();