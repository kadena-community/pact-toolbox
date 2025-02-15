import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

import { createDevNetNetworkConfig } from "@pact-toolbox/config";
import { logger } from "@pact-toolbox/utils";

// Mock the logger to prevent actual logging during tests
logger.mockTypes(() => mock.fn());

class MockDockerService {
  createContainer = mock.fn();
  startContainer = mock.fn();
  pullImageIfNotExists = mock.fn();
  createVolumeIfNotExists = mock.fn();
  removeContainerIfExists = mock.fn();
}

// Mock utility functions
const utilsMock = {
  isChainWebNodeOk: mock.fn(),
  isChainWebAtHeight: mock.fn(),
  didMakeBlocks: mock.fn(),
  pollFn: mock.fn(),
  cleanupOnExit: mock.fn(),
  getUuid: mock.fn(),
  isDockerInstalled: mock.fn(),
  DockerService: MockDockerService,
  logger,
};

// Mock implementations
// @ts-expect-error
utilsMock.isDockerInstalled.mock.mockImplementation(() => true);
// @ts-expect-error
utilsMock.isChainWebNodeOk.mock.mockImplementation(() => Promise.resolve(true));
// @ts-expect-error
utilsMock.isChainWebAtHeight.mock.mockImplementation(() => Promise.resolve(true));
// @ts-expect-error
utilsMock.didMakeBlocks.mock.mockImplementation(() => Promise.resolve(true));
// @ts-expect-error
utilsMock.getUuid.mock.mockImplementation(() => "test-uuid");
// @ts-expect-error
utilsMock.pollFn.mock.mockImplementation(async (fn) => {
  await fn();
});

// Mocking the @pact-toolbox/utils module
mock.module("@pact-toolbox/utils", {
  namedExports: utilsMock,
});

// Import the module under test after mocking
const { LocalDevNetNetwork, devNetMiningConfigToEnvVars } = await import("./devnet");

describe("LocalDevNetNetwork", () => {
  const containerMock = {
    id: "mock-container-id",
    inspect: mock.fn(),
    kill: mock.fn(),
  };
  // @ts-expect-error
  containerMock.inspect.mock.mockImplementation(() => Promise.resolve({ State: { Running: true } }));
  // @ts-expect-error
  containerMock.kill.mock.mockImplementation(() => Promise.resolve());

  const dockerService = new MockDockerService() as any;
  dockerService.pullImageIfNotExists.mock.mockImplementation(() => Promise.resolve());
  dockerService.createVolumeIfNotExists.mock.mockImplementation(() => Promise.resolve());
  dockerService.removeContainerIfExists.mock.mockImplementation(() => Promise.resolve());
  dockerService.createContainer.mock.mockImplementation(() => Promise.resolve(containerMock));
  dockerService.startContainer.mock.mockImplementation(() => Promise.resolve());

  beforeEach(() => {
    // Reset all mock calls
    utilsMock.isChainWebNodeOk.mock.resetCalls();
    utilsMock.isChainWebAtHeight.mock.resetCalls();
    utilsMock.didMakeBlocks.mock.resetCalls();
    utilsMock.pollFn.mock.resetCalls();
    dockerService.pullImageIfNotExists.mock.resetCalls();
    dockerService.createContainer.mock.resetCalls();
    dockerService.startContainer.mock.resetCalls();
    dockerService.createVolumeIfNotExists.mock.resetCalls();
    dockerService.removeContainerIfExists.mock.resetCalls();
    containerMock.inspect.mock.resetCalls();
    containerMock.kill.mock.resetCalls();
  });

  it("should convert mining config to environment variables correctly", () => {
    const miningConfig = {
      batchPeriod: 100,
      confirmationCount: 5,
      confirmationPeriod: 200,
      disableConfirmation: true,
      disableIdle: false,
      idlePeriod: 300,
    };

    const envVars = devNetMiningConfigToEnvVars(miningConfig);

    assert.deepEqual(envVars, {
      MINING_BATCH_PERIOD: "100",
      MINING_CONFIRMATION_COUNT: "5",
      MINING_CONFIRMATION_PERIOD: "200",
      MINING_DISABLE_CONFIRMATION: "true",
      MINING_DISABLE_IDLE: "false",
      MINING_IDLE_PERIOD: "300",
    });
  });

  it("should initialize correctly with correct DevNetContainerConfig", () => {
    const networkConfig = createDevNetNetworkConfig({
      containerConfig: {
        image: "custom/devnet",
        tag: "v1.0.0",
        port: 9090,
        volume: "custom_volume",
      },
      miningConfig: {
        batchPeriod: 100,
      },
    });

    const network = new LocalDevNetNetwork(networkConfig, dockerService);

    assert.equal(network.image, "custom/devnet:v1.0.0");
    assert.equal(network.getServicePort(), 9090);
    assert.deepEqual(network["containerEnv"], {
      MINING_BATCH_PERIOD: "100",
    });
    assert.equal(network.volume, "custom_volume");
  });

  it("should start successfully using correct DockerContainerConfig", async () => {
    const networkConfig = createDevNetNetworkConfig();
    const network = new LocalDevNetNetwork(networkConfig, dockerService);

    await network.start();

    // Assertions
    assert.equal(dockerService.pullImageIfNotExists.mock.calls.length, 1, "pullImageIfNotExists should be called once");
    assert.equal(dockerService.createContainer.mock.calls.length, 1, "createContainer should be called once");
    assert.equal(dockerService.startContainer.mock.calls.length, 1, "startContainer should be called once");
    assert.equal(utilsMock.pollFn.mock.calls.length, 3, "pollFn should be called three times");

    // Verify that utility functions were called
    assert.equal(utilsMock.isChainWebNodeOk.mock.calls.length, 1, "isChainWebNodeOk should be called once");
    assert.equal(utilsMock.didMakeBlocks.mock.calls.length, 1, "didMakeBlocks should be called once");
    assert.equal(utilsMock.isChainWebAtHeight.mock.calls.length, 1, "isChainWebAtHeight should be called once");
  });

  it("should stop the container without explicit removal", async () => {
    const containerMock = {
      id: "mock-container-id",
      inspect: mock.fn(),
      kill: mock.fn(),
    };
    // @ts-expect-error
    containerMock.inspect.mock.mockImplementation(() => Promise.resolve({ State: { Running: true } }));
    // @ts-expect-error
    containerMock.kill.mock.mockImplementation(() => Promise.resolve());

    const networkConfig = createDevNetNetworkConfig({});
    const network = new LocalDevNetNetwork(networkConfig, dockerService);

    // Inject the mock container
    (network as any).container = containerMock;

    await network.stop();

    // Assertions
    assert.equal(containerMock.kill.mock.calls.length, 1, "kill should be called once");
  });

  it("should handle start failure gracefully", async () => {
    dockerService.pullImageIfNotExists.mock.mockImplementation(() => Promise.reject(new Error("Docker error")));

    const networkConfig = createDevNetNetworkConfig();

    const network = new LocalDevNetNetwork(networkConfig, dockerService);

    await assert.rejects(network.start(), /Docker error/);
  });

  it("should restart the network", async () => {
    dockerService.pullImageIfNotExists.mock.mockImplementation(() => Promise.resolve());
    const networkConfig = createDevNetNetworkConfig();
    const network = new LocalDevNetNetwork(networkConfig, dockerService);

    await network.start();
    await network.restart();

    // Assertions
    assert.equal(
      dockerService.pullImageIfNotExists.mock.calls.length,
      2,
      "pullImageIfNotExists should be called twice",
    );
    assert.equal(dockerService.createContainer.mock.calls.length, 2, "createContainer should be called twice");
    assert.equal(dockerService.startContainer.mock.calls.length, 2, "startContainer should be called twice");
    assert.equal(utilsMock.pollFn.mock.calls.length, 6, "pollFn should be called six times");
  });
});
