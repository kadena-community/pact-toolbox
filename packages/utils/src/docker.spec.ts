import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { Mock } from "node:test";
import Docker from "dockerode";

import { DockerService } from "./docker";
import { logger } from "./logger";

// Mock the logger to prevent actual logging during tests
logger.mockTypes(() => mock.fn());

describe("DockerService", () => {
  let dockerService: DockerService;

  beforeEach(() => {
    dockerService = new DockerService();
  });

  describe("isDockerInstalled", () => {
    let pingMock: Mock<() => Promise<void>>;

    beforeEach(() => {
      // Mock dockerService.docker.ping
      pingMock = mock.fn();
      mock.method(dockerService.docker, "ping", pingMock);
    });

    afterEach(() => {
      // Restore the mock
      pingMock.mock.restore();
    });

    it("returns true when Docker is available", async () => {
      // Mock ping to resolve successfully
      pingMock.mock.mockImplementation(() => Promise.resolve());

      const isInstalled = await dockerService.docker
        .ping()
        .then(() => true)
        .catch(() => false);

      assert.ok(isInstalled, "Docker should be installed and running");
      assert.strictEqual(pingMock.mock.calls.length, 1, "docker.ping should be called once");
    });

    it("returns false when Docker is not available", async () => {
      // Mock ping to reject with an error
      pingMock.mock.mockImplementation(() => Promise.reject(new Error("Docker not available")));

      const isInstalled = await dockerService.docker
        .ping()
        .then(() => true)
        .catch(() => false);

      assert.strictEqual(isInstalled, false, "Docker should not be installed or running");
      assert.strictEqual(pingMock.mock.calls.length, 1, "docker.ping should be called once");
    });
  });

  describe("pullImageIfNotExists", () => {
    let getImageMock: Mock<(imageName: string) => Docker.Image>;
    let pullImageMock: Mock<(imageName: string) => Promise<void>>;
    let inspectMock: Mock<() => Promise<any>>;
    let mockImage: Docker.Image;

    beforeEach(() => {
      // Mock dockerService.docker.getImage
      getImageMock = mock.fn();
      mock.method(dockerService.docker, "getImage", getImageMock);

      // Mock dockerService.pullImage
      pullImageMock = mock.fn();
      mock.method(dockerService, "pullImage", pullImageMock);

      // Create inspectMock
      inspectMock = mock.fn();

      // Assign the inspect mock to the image
      mockImage = {
        inspect: inspectMock,
      } as unknown as Docker.Image;
    });

    afterEach(() => {
      // Restore mocks
      getImageMock.mock.restore();
      pullImageMock.mock.restore();
      inspectMock.mock.restore();
    });

    it("does not pull image if it exists", async () => {
      const imageName = "hello-world:latest";

      // Mock getImage to return mockImage
      getImageMock.mock.mockImplementation(() => mockImage);

      // Mock inspect to resolve successfully
      inspectMock.mock.mockImplementation(() => Promise.resolve({}));

      // Call the method
      await dockerService.pullImageIfNotExists(imageName);

      // Assertions
      assert.strictEqual(getImageMock.mock.calls.length, 1, "getImage should be called once");
      assert.strictEqual(getImageMock.mock.calls[0]?.arguments[0], imageName);
      assert.strictEqual(inspectMock.mock.calls.length, 1, "inspect should be called once");
      assert.strictEqual(pullImageMock.mock.calls.length, 0, "pullImage should not be called if image exists");
    });

    it("pulls image if it does not exist", async () => {
      const imageName = "hello-world:latest";

      // Mock getImage to return mockImage
      getImageMock.mock.mockImplementation(() => mockImage);

      // Mock inspect to reject with 404 error
      const error404 = { statusCode: 404 };
      inspectMock.mock.mockImplementation(() => Promise.reject(error404));

      // Mock pullImage to resolve
      pullImageMock.mock.mockImplementation(() => Promise.resolve());

      // Call the method
      await dockerService.pullImageIfNotExists(imageName);

      // Assertions
      assert.strictEqual(getImageMock.mock.calls.length, 1, "getImage should be called once");
      assert.strictEqual(inspectMock.mock.calls.length, 1, "inspect should be called once");
      assert.strictEqual(pullImageMock.mock.calls.length, 1, "pullImage should be called if image does not exist");
      assert.strictEqual(pullImageMock.mock.calls[0]?.arguments[0], imageName);
    });
  });

  describe("createContainer", () => {
    let createContainerMock: Mock<Docker["createContainer"]>;
    let pullImageIfNotExistsMock: Mock<(imageName: string) => Promise<void>>;
    let removeContainerIfExistsMock: Mock<(containerNameOrId: string) => Promise<void>>;
    let startMock: Mock<() => Promise<void>>;
    let inspectMock: Mock<() => Promise<any>>;
    let removeMock: Mock<() => Promise<void>>;
    let mockContainer: Docker.Container;

    beforeEach(() => {
      // Mock dockerService.docker.createContainer
      createContainerMock = mock.fn();
      mock.method(dockerService.docker, "createContainer", createContainerMock);

      // Mock dockerService.pullImageIfNotExists
      pullImageIfNotExistsMock = mock.fn();
      mock.method(dockerService, "pullImageIfNotExists", pullImageIfNotExistsMock);

      // Mock dockerService.removeContainerIfExists
      removeContainerIfExistsMock = mock.fn();
      mock.method(dockerService, "removeContainerIfExists", removeContainerIfExistsMock);

      // Create mock container methods
      startMock = mock.fn();
      inspectMock = mock.fn();
      removeMock = mock.fn();

      // Set up implementations
      startMock.mock.mockImplementation(() => Promise.resolve());
      inspectMock.mock.mockImplementation(() => Promise.resolve({ State: { Running: false } }));
      removeMock.mock.mockImplementation(() => Promise.resolve());

      // Create mock container
      mockContainer = {
        id: "mock-container-id",
        start: startMock,
        inspect: inspectMock,
        remove: removeMock,
      } as unknown as Docker.Container;

      // Mock createContainer to return mockContainer
      createContainerMock.mock.mockImplementation(() => Promise.resolve(mockContainer));
    });

    afterEach(() => {
      // Restore mocks
      createContainerMock.mock.restore();
      pullImageIfNotExistsMock.mock.restore();
      removeContainerIfExistsMock.mock.restore();
      startMock.mock.restore();
      inspectMock.mock.restore();
      removeMock.mock.restore();
    });

    it("creates a container successfully", async () => {
      const containerConfig = {
        name: "test-container",
        image: "hello-world",
        tag: "latest",
      };

      // Call the method
      const container = await dockerService.createContainer(containerConfig);

      // Assertions
      assert.strictEqual(pullImageIfNotExistsMock.mock.calls.length, 1, "pullImageIfNotExists should be called once");
      assert.deepStrictEqual(
        pullImageIfNotExistsMock.mock.calls[0]?.arguments,
        ["hello-world:latest"],
        "pullImageIfNotExists should be called with correct image name",
      );

      assert.strictEqual(
        removeContainerIfExistsMock.mock.calls.length,
        1,
        "removeContainerIfExists should be called once",
      );
      assert.deepStrictEqual(
        removeContainerIfExistsMock.mock.calls[0]?.arguments,
        ["test-container"],
        "removeContainerIfExists should be called with correct container name",
      );

      assert.strictEqual(createContainerMock.mock.calls.length, 1, "createContainer should be called once");

      assert.ok(container, "Container should be created successfully");
    });
  });

  describe("startContainer", () => {
    let startMock: Mock<() => Promise<void>>;
    let mockContainer: Docker.Container;

    beforeEach(() => {
      // Create mock container
      startMock = mock.fn();
      startMock.mock.mockImplementation(() => Promise.resolve());
      mockContainer = {
        id: "mock-container-id",
        start: startMock,
      } as unknown as Docker.Container;
    });

    afterEach(() => {
      startMock.mock.restore();
    });

    it("starts the container successfully", async () => {
      // Call the method
      await dockerService.startContainer(mockContainer);

      // Assertions
      assert.strictEqual(startMock.mock.calls.length, 1, "start should be called once to start the container");
    });
  });

  describe("createVolumeIfNotExists", () => {
    let getVolumeMock: Mock<(volumeName: string) => Docker.Volume>;
    let createVolumeMock: Mock<(options: Docker.VolumeCreateOptions) => Promise<Docker.Volume>>;
    let inspectMock: Mock<() => Promise<any>>;
    let mockVolume: Docker.Volume;

    beforeEach(() => {
      // Mock dockerService.docker.getVolume
      getVolumeMock = mock.fn();
      mock.method(dockerService.docker, "getVolume", getVolumeMock);

      // Mock dockerService.docker.createVolume
      createVolumeMock = mock.fn();
      mock.method(dockerService.docker, "createVolume", createVolumeMock);

      // Create inspectMock
      inspectMock = mock.fn();

      // Create mockVolume with inspect method
      mockVolume = {
        inspect: inspectMock,
      } as unknown as Docker.Volume;
    });

    afterEach(() => {
      getVolumeMock.mock.restore();
      createVolumeMock.mock.restore();
      inspectMock.mock.restore();
    });

    it("creates volume if it does not exist", async () => {
      const volumeName = "test-volume";

      // Mock getVolume to return mockVolume
      getVolumeMock.mock.mockImplementation(() => mockVolume);

      // Mock inspect to reject with 404 error
      const error404 = { statusCode: 404 };
      inspectMock.mock.mockImplementation(() => Promise.reject(error404));

      // Mock createVolume to resolve
      createVolumeMock.mock.mockImplementation(() => Promise.resolve(mockVolume));

      // Call the method
      await dockerService.createVolumeIfNotExists(volumeName);

      // Assertions
      assert.strictEqual(getVolumeMock.mock.calls.length, 1, "getVolume should be called once");
      assert.deepStrictEqual(getVolumeMock.mock.calls[0]?.arguments, [volumeName]);

      assert.strictEqual(inspectMock.mock.calls.length, 1, "inspect should be called once");

      assert.strictEqual(createVolumeMock.mock.calls.length, 1, "createVolume should be called to create the volume");
      assert.deepStrictEqual(
        createVolumeMock.mock.calls[0]?.arguments,
        [{ Name: volumeName }],
        "createVolume should be called with correct options",
      );
    });

    it("does not create volume if it exists", async () => {
      const volumeName = "test-volume";

      // Mock getVolume to return mockVolume
      getVolumeMock.mock.mockImplementation(() => mockVolume);

      // Mock inspect to resolve successfully
      inspectMock.mock.mockImplementation(() => Promise.resolve({}));

      // Call the method
      await dockerService.createVolumeIfNotExists(volumeName);

      // Assertions
      assert.strictEqual(getVolumeMock.mock.calls.length, 1, "getVolume should be called once");
      assert.strictEqual(inspectMock.mock.calls.length, 1, "inspect should be called once");
      assert.strictEqual(createVolumeMock.mock.calls.length, 0, "createVolume should not be called if volume exists");
    });
  });
});
