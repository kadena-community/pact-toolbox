import { describe, test, expect, beforeEach, vi } from "vitest";
import { runReplTests, createPactTestEnv } from "./index";

// Mock dependencies with proper hoisting
vi.mock("@pact-toolbox/config", async () => {
  const actual = await vi.importActual("@pact-toolbox/config");
  const mockConfig = {
    contractsDir: "./contracts",
    networks: {
      testnet: {
        networkId: "testnet",
        rpcUrl: "http://localhost:8080",
        type: "pact-server" as const,
        chainId: "0",
        containerConfig: {
          pactServerBinary: "pact-server",
          pactServerArgs: [],
          logLevel: "info" as const,
          persistDb: false,
          onDemandMining: true,
        },
      },
    },
    preludes: [],
    defaultNetwork: "testnet",
    scriptsDir: "./scripts",
    pactVersion: "4.0.0",
    downloadPreludes: true,
    deployPreludes: true,
  };

  return {
    ...actual,
    resolveConfig: vi.fn().mockResolvedValue(mockConfig),
  };
});

vi.mock("@pact-toolbox/node-utils", async () => {
  const actual = await vi.importActual("@pact-toolbox/node-utils");
  return {
    ...actual,
    glob: vi.fn().mockResolvedValue({
      directories: [],
      files: ["./contracts/test1.repl", "./contracts/test2.repl"],
      symlinks: [],
      directoriesFound: [],
      filesFound: ["./contracts/test1.repl", "./contracts/test2.repl"],
      symlinksFound: [],
      directoriesFoundNames: new Set(),
      filesFoundNames: new Set(["test1.repl", "test2.repl"]),
      symlinksFoundNames: new Set(),
      directoriesFoundNamesToPaths: {},
      filesFoundNamesToPaths: {
        "test1.repl": ["./contracts/test1.repl"],
        "test2.repl": ["./contracts/test2.repl"],
      },
      symlinksFoundNamesToPaths: {},
    }),
    execAsync: vi.fn().mockResolvedValue({ stdout: "Test passed", stderr: "", code: 0 }),
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
    updateSpinner: vi.fn(),
    boxMessage: vi.fn(),
    table: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };
});

vi.mock("@pact-toolbox/network", () => ({
  createPactToolboxNetwork: vi.fn().mockResolvedValue({
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    isOk: vi.fn().mockResolvedValue(true),
  }),
  PactToolboxNetwork: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    isOk: vi.fn().mockResolvedValue(true),
    config: {},
  })),
}));

vi.mock("@pact-toolbox/runtime", () => ({
  PactToolboxClient: vi.fn().mockImplementation(() => ({
    getContext: vi.fn().mockReturnValue({
      getDefaultSigner: vi.fn(),
      getSignerKeys: vi.fn(),
    }),
  })),
}));

vi.mock("@pact-toolbox/wallet-adapters/keypair", () => ({
  KeypairWallet: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    getAccounts: vi.fn().mockResolvedValue(["test-account"]),
  })),
}));

describe("@pact-toolbox/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to create mock glob result
  const createMockGlobResult = (files: string[]) => ({
    directories: [],
    files,
    symlinks: [],
    directoriesFound: [],
    filesFound: files,
    symlinksFound: [],
    directoriesFoundNames: new Set<string>(),
    filesFoundNames: new Set(files.map((f) => f.split("/").pop() || "")),
    symlinksFoundNames: new Set<string>(),
    directoriesFoundNamesToPaths: {},
    filesFoundNamesToPaths: files.reduce(
      (acc, file) => {
        const name = file.split("/").pop() || "";
        if (!acc[name]) acc[name] = [];
        acc[name].push(file);
        return acc;
      },
      {} as Record<string, string[]>,
    ),
    symlinksFoundNamesToPaths: {},
  });

  describe("runReplTests", () => {
    test("runs with default config when no config provided", async () => {
      const { glob } = await import("@pact-toolbox/node-utils");

      vi.mocked(glob).mockResolvedValue(createMockGlobResult(["test1.repl", "test2.repl"]));

      await runReplTests();

      expect(glob).toHaveBeenCalledWith(
        "**/*.repl",
        expect.objectContaining({
          ignore: ["prelude/**"],
        }),
      );
    });

    test("runs with provided config", async () => {
      const { glob } = await import("@pact-toolbox/node-utils");

      vi.mocked(glob).mockResolvedValue(createMockGlobResult(["custom-test.repl"]));

      await runReplTests();

      expect(glob).toHaveBeenCalled();
    });

    test("handles empty test results", async () => {
      const { glob } = await import("@pact-toolbox/node-utils");

      vi.mocked(glob).mockResolvedValue(createMockGlobResult([]));

      await runReplTests();

      expect(glob).toHaveBeenCalled();
    });

    test("processes multiple test files", async () => {
      const { glob, execAsync } = await import("@pact-toolbox/node-utils");

      vi.mocked(glob).mockResolvedValue(createMockGlobResult(["test1.repl", "test2.repl", "test3.repl"]));

      await runReplTests();

      expect(glob).toHaveBeenCalled();
      expect(execAsync).toHaveBeenCalledTimes(3);
    });

    test("ignores prelude directory by default", async () => {
      const { glob } = await import("@pact-toolbox/node-utils");

      await runReplTests();

      expect(glob).toHaveBeenCalledWith(
        "**/*.repl",
        expect.objectContaining({
          ignore: ["prelude/**"],
        }),
      );
    });
  });

  describe("createPactTestEnv", () => {
    test("creates test environment with default settings", async () => {
      const env = await createPactTestEnv();

      expect(env).toHaveProperty("client");
      expect(env).toHaveProperty("config");
      expect(env).toHaveProperty("network");
      expect(env).toHaveProperty("wallet");
      expect(env).toHaveProperty("start");
      expect(env).toHaveProperty("stop");
      expect(env).toHaveProperty("restart");
    });

    test("test environment methods are callable", async () => {
      const env = await createPactTestEnv();

      // These should be functions that can be called
      expect(typeof env.start).toBe("function");
      expect(typeof env.stop).toBe("function");
      expect(typeof env.restart).toBe("function");
    });

    test("injects test mode flag", async () => {
      await createPactTestEnv();

      expect((globalThis as any).__PACT_TOOLBOX_TEST_MODE__).toBe(true);
    });

    test("creates test environment with private key option", async () => {
      const env = await createPactTestEnv({
        privateKey: "test-private-key",
      });

      expect(env.wallet).toBeDefined();
    });

    test("creates test environment with account name option", async () => {
      const env = await createPactTestEnv({
        accountName: "test-account",
      });

      expect(env.wallet).toBeDefined();
    });
  });

  describe("utility functions", () => {
    test("getConfigOverrides returns valid config object", async () => {
      const { getConfigOverrides } = await import("./utils");

      const overrides = getConfigOverrides({
        contractsDir: "./test-contracts",
      });

      expect(overrides).toHaveProperty("contractsDir", "./test-contracts");
    });

    test("injectNetworkConfig sets global variables", async () => {
      const { injectNetworkConfig } = await import("./utils");

      const config = {
        networks: {
          testnet: {
            networkId: "testnet",
            rpcUrl: "http://localhost:8080",
            type: "pact-server" as const,
            chainId: "0",
          },
        },
        defaultNetwork: "testnet",
      };

      injectNetworkConfig(config as any);

      expect((globalThis as any).__PACT_TOOLBOX_NETWORKS__).toBeDefined();
    });
  });
});
