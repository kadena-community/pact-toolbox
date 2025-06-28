// jest.config.js
module.exports = {
  // Use the Pact transformer for .pact files
  transform: {
    "\\.pact$": [
      "@pact-toolbox/unplugin/jest",
      {
        generateTypes: true,
        debug: process.env.DEBUG === "true",
      },
    ],
  },

  // Treat .pact files as ESM
  extensionsToTreatAsEsm: [".pact"],

  // Module file extensions
  moduleFileExtensions: ["js", "ts", "json", "pact"],

  // Test environment
  testEnvironment: "node",

  // Test patterns
  testMatch: ["**/__tests__/**/*.(test|spec).(js|ts)", "**/*.(test|spec).(js|ts)"],

  // Transform node_modules if needed
  transformIgnorePatterns: ["node_modules/(?!(@pact-toolbox)/)"],

  // For TypeScript support
  preset: "ts-jest",

  // Global setup/teardown (optional)
  globalSetup: "./test/setup.js",
  globalTeardown: "./test/teardown.js",
};

// Example test file: __tests__/contracts.test.js
/*
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { helloWorld } from '../contracts/hello-world.pact';
import { createPactToolboxClient } from '@pact-toolbox/runtime';

describe('Hello World Contract', () => {
  let client;
  
  beforeAll(async () => {
    // Setup client for contract execution
    client = await createPactToolboxClient({
      network: 'testnet'
    });
  });
  
  afterAll(async () => {
    // Cleanup
    await client?.close();
  });

  it('should import pact module', () => {
    expect(helloWorld).toBeDefined();
    expect(helloWorld.__module).toBeDefined();
    expect(helloWorld.__module.name).toBe('hello-world');
  });

  it('should have typed functions', () => {
    // TypeScript types are generated
    expect(typeof helloWorld.sayHello).toBe('function');
  });

  it('should execute contract function', async () => {
    const result = helloWorld.sayHello('World');
    expect(result).toBe('Hello, World!');
  });
});
*/
