import { describe, test, expect, beforeEach, vi } from "vitest";
import { PactToolboxClient } from "./index";
import type { PactToolboxConfigObj, NetworkConfig } from "@pact-toolbox/config";
import { PactTransactionBuilder, PactTransactionDispatcher, execution } from "@pact-toolbox/transaction";
import type { ChainId } from "@pact-toolbox/types";
import fs from "fs/promises";

// Mock dependencies
vi.mock("@pact-toolbox/transaction", async () => {
  const mockContext = {
    getCurrentNetworkConfig: vi.fn(),
    getNetworkId: vi.fn(),
    getMeta: vi.fn(),
    getSignerKeys: vi.fn(),
    getDefaultSigner: vi.fn(),
    getClient: vi.fn(),
    getNetworkConfig: vi.fn(),
    getAllNetworkConfigs: vi.fn(),
    getAvailableNetworks: vi.fn(),
    switchNetwork: vi.fn(),
    isNetworkAvailable: vi.fn(),
    getNetworkType: vi.fn(),
    isLocalNetwork: vi.fn(),
    isProductionNetwork: vi.fn(),
    subscribe: vi.fn(),
    getWallet: vi.fn(),
    setWallet: vi.fn(),
  };

  return {
    PactTransactionBuilder: vi.fn(),
    PactTransactionDispatcher: vi.fn(),
    execution: vi.fn(),
    createToolboxNetworkContext: vi.fn(() => mockContext),
    getKAccountKey: vi.fn((key: string) => `k:${key}`),
  };
});
vi.mock("fs/promises");
vi.mock("@pact-toolbox/wallet-adapters/keypair", () => {
  const mockWallet = {
    getAccount: vi.fn().mockResolvedValue({
      publicKey: "test-public-key",
      secretKey: "test-secret-key",
      account: "sender00",
    }),
    sign: vi.fn().mockResolvedValue({ cmd: "{}", hash: "hash", sigs: [] }),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
  
  return {
    KeypairWallet: vi.fn(() => mockWallet),
  };
});

describe("@pact-toolbox/runtime", () => {
  let mockConfig: PactToolboxConfigObj;
  let mockDispatcher: any;
  let mockBuilder: any;
  let mockContext: any;

  beforeEach(async () => {
    // Setup default config
    mockConfig = {
      contractsDir: "./contracts",
      scriptsDir: "./scripts",
      preludes: ["kadena/chainweb"],
      defaultNetwork: "default",
      networks: {
        default: {
          type: "chainweb-devnet" as const,
          name: "local-devnet",
          networkId: "devnet",
          rpcUrl: "http://localhost:8080",
          senderAccount: "sender00",
          keyPairs: [],
          keysets: {},
          meta: { chainId: "0" },
        },
      },
    };

    // Setup mock dispatcher
    mockDispatcher = {
      submit: vi.fn().mockResolvedValue({ requestKey: "request-key-123" }),
      submitAndListen: vi.fn().mockResolvedValue({ status: "success", data: {} }),
      local: vi.fn().mockResolvedValue({ status: "success", data: {} }),
      dirtyRead: vi.fn().mockResolvedValue({ status: "success", data: {} }),
      submitAll: vi.fn().mockResolvedValue([{ requestKey: "request-key-123" }]),
      submitAndListenAll: vi.fn().mockResolvedValue([{ status: "success", data: {} }]),
      localAll: vi.fn().mockResolvedValue([{ status: "success", data: {} }]),
      dirtyReadAll: vi.fn().mockResolvedValue([{ status: "success", data: {} }]),
      getSignedTransaction: vi.fn().mockResolvedValue({ cmd: "{}", hash: "hash", sigs: [] }),
    };

    // Setup mock builder
    mockBuilder = {
      withData: vi.fn().mockReturnThis(),
      withDataMap: vi.fn().mockReturnThis(),
      withMeta: vi.fn().mockReturnThis(),
      withSigner: vi.fn().mockReturnThis(),
      withVerifier: vi.fn().mockReturnThis(),
      withKeyset: vi.fn().mockReturnThis(),
      withKeysetMap: vi.fn().mockReturnThis(),
      withChainId: vi.fn().mockReturnThis(),
      withNetworkId: vi.fn().mockReturnThis(),
      withNonce: vi.fn().mockReturnThis(),
      withContext: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue(mockDispatcher),
      sign: vi.fn().mockReturnValue(mockDispatcher),
      quickSign: vi.fn().mockReturnValue(mockDispatcher),
      getPartialTransaction: vi.fn().mockResolvedValue({ cmd: "{}", hash: "hash", sigs: [] }),
      getCommand: vi.fn().mockReturnValue({ payload: { exec: { code: "", data: {} } }, meta: {}, signers: [] }),
    };

    // Setup mock context with proper return values
    mockContext = {
      getCurrentNetworkConfig: vi.fn().mockReturnValue(mockConfig.networks['default']),
      getNetworkId: vi.fn().mockReturnValue("devnet"),
      getMeta: vi.fn().mockReturnValue({ chainId: "0" }),
      getSignerKeys: vi.fn().mockReturnValue({
        publicKey: "test-public-key",
        secretKey: "test-secret-key",
        account: "sender00",
      }),
      getDefaultSigner: vi.fn().mockReturnValue({
        pubKey: "test-public-key",
        address: "sender00",
        scheme: "ED25519",
      }),
      getClient: vi.fn().mockReturnValue({}),
      getNetworkConfig: vi.fn().mockReturnValue(mockConfig.networks['default']),
      getAllNetworkConfigs: vi.fn().mockReturnValue([mockConfig.networks['default']]),
      getAvailableNetworks: vi.fn().mockReturnValue(["default"]),
      switchNetwork: vi.fn().mockResolvedValue(undefined),
      isNetworkAvailable: vi.fn().mockReturnValue(true),
      getNetworkType: vi.fn().mockReturnValue("chainweb-devnet"),
      isLocalNetwork: vi.fn().mockReturnValue(true),
      isProductionNetwork: vi.fn().mockReturnValue(false),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getWallet: vi.fn().mockReturnValue(null),
      setWallet: vi.fn(),
    };

    // Get mocked module and set up return values
    const { createToolboxNetworkContext } = await import("@pact-toolbox/transaction");
    vi.mocked(createToolboxNetworkContext).mockReturnValue(mockContext);
    
    // Set up mock context methods to return proper values
    mockContext.getCurrentNetworkConfig.mockReturnValue(mockConfig.networks['default']);
    mockContext.getNetworkId.mockReturnValue("devnet");
    mockContext.getMeta.mockReturnValue({ chainId: "0" });
    mockContext.getSignerKeys.mockReturnValue({
      publicKey: "test-public-key",
      secretKey: "test-secret-key",
      account: "sender00",
    });
    mockContext.getDefaultSigner.mockReturnValue({
      pubKey: "test-public-key",
      address: "sender00",
      scheme: "ED25519",
    });
    mockContext.getNetworkConfig.mockReturnValue(mockConfig.networks['default']);
    mockContext.getAllNetworkConfigs.mockReturnValue([mockConfig.networks['default']]);
    mockContext.getAvailableNetworks.mockReturnValue(["default"]);
    mockContext.isNetworkAvailable.mockReturnValue(true);
    mockContext.getNetworkType.mockReturnValue("chainweb-devnet");
    mockContext.isLocalNetwork.mockReturnValue(true);
    mockContext.isProductionNetwork.mockReturnValue(false);
    mockContext.getWallet.mockReturnValue(null);
    mockContext.subscribe.mockReturnValue(() => {});

    vi.mocked(PactTransactionDispatcher).mockImplementation(() => mockDispatcher);
    vi.mocked(PactTransactionBuilder).mockImplementation(() => mockBuilder);
    vi.mocked(execution).mockReturnValue(mockBuilder);

    vi.clearAllMocks();
  });

  describe("PactToolboxClient Construction", () => {
    test("creates client with basic config", () => {
      const client = new PactToolboxClient(mockConfig);

      expect(client).toBeDefined();
      expect(client.getConfig()).toEqual(mockConfig);
    });

    test("initializes network context with config", () => {
      const client = new PactToolboxClient(mockConfig);
      const networkConfig = client.getNetworkConfig();

      expect(networkConfig).toBeDefined();
      expect(networkConfig.type).toBe("chainweb-devnet");
      expect(networkConfig.name).toBe("local-devnet");
    });

    test("handles different network types", () => {
      // Pact Server
      const pactServerConfig: PactToolboxConfigObj = {
        defaultNetwork: "default",
        networks: {
          default: {
            type: "pact-server" as const,
            name: "local",
            networkId: "pact-server",
            rpcUrl: "http://localhost:9001",
            senderAccount: "sender00",
            keyPairs: [],
            keysets: {},
            meta: { chainId: "0" },
          },
        },
      };

      // Update mock context to return pact-server config
      mockContext.getCurrentNetworkConfig.mockReturnValue(pactServerConfig.networks['default']);
      mockContext.getNetworkType.mockReturnValue("pact-server");

      const pactClient = new PactToolboxClient(pactServerConfig);
      const pactNetworkConfig = pactClient.getNetworkConfig();
      expect(pactNetworkConfig.type).toBe("pact-server");
      expect(pactClient.isPactServerNetwork()).toBe(true);

      // Chainweb
      const chainwebConfig: PactToolboxConfigObj = {
        defaultNetwork: "default",
        networks: {
          default: {
            type: "chainweb" as const,
            name: "testnet",
            networkId: "testnet04",
            rpcUrl: "https://api.testnet.chainweb.com",
            senderAccount: "sender00",
            keyPairs: [],
            keysets: {},
            meta: { chainId: "0" },
          },
        },
      };

      // Update mock context to return chainweb config
      mockContext.getCurrentNetworkConfig.mockReturnValue(chainwebConfig.networks['default']);
      mockContext.getNetworkType.mockReturnValue("chainweb");

      const chainwebClient = new PactToolboxClient(chainwebConfig);
      const chainwebNetworkConfig = chainwebClient.getNetworkConfig();
      expect(chainwebNetworkConfig.type).toBe("chainweb");
      expect(chainwebNetworkConfig.name).toBe("testnet");
      expect(chainwebClient.isChainwebNetwork()).toBe(true);
    });

    test("loads signer from environment variables", () => {
      process.env["DEVNET_PUBLIC_KEY"] = "public-key";
      process.env["DEVNET_SECRET_KEY"] = "secret-key";

      const client = new PactToolboxClient(mockConfig);

      const signer = client.getSignerKeys();

      expect(signer).toEqual(
        expect.objectContaining({
          publicKey: "public-key",
          secretKey: "secret-key",
        }),
      );

      delete process.env["DEVNET_PUBLIC_KEY"];
      delete process.env["DEVNET_SECRET_KEY"];
    });

    test("uses signers from config", () => {
      // Setup mock network with devnet config
      const networkWithSender: PactToolboxConfigObj = {
        ...mockConfig,
        networks: {
          default: {
            ...mockConfig.networks["default"],
            senderAccount: "alice",
          } as NetworkConfig,
        },
      };

      const mockContext = {
        getSignerKeys: vi.fn().mockReturnValue({
          publicKey: "config-public",
          secretKey: "config-secret",
          account: "alice",
        }),
      };

      const client = new PactToolboxClient(networkWithSender);
      client.context = mockContext as any;

      const signer = client.getSignerKeys("alice");

      expect(signer).toEqual({
        publicKey: "config-public",
        secretKey: "config-secret",
        account: "alice",
      });
    });
  });

  describe("Contract Deployment", () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
      vi.mocked(fs.readFile).mockResolvedValue("(module test ...)");
      vi.mocked(fs.access).mockResolvedValue(undefined);
    });

    test("deployContract loads and deploys file", async () => {
      await client.deployContract("token.pact");

      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining("token.pact"), "utf-8");
      expect(execution).toHaveBeenCalledWith("(module test ...)", expect.any(Object));
      expect(mockDispatcher.submitAndListen).toHaveBeenCalled();
    });

    test("deployContract handles .pact extension", async () => {
      await client.deployContract("token");

      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining("token.pact"), "utf-8");
    });

    test("deployContract with custom options and chainIds", async () => {
      await client.deployContract(
        "token.pact",
        {
          preflight: false,
          listen: false,
          builder: {
            data: {
              gasLimit: 100000,
              gasPrice: 0.00001,
            },
          },
        },
        ["0", "1"],
      );

      expect(mockBuilder.withDataMap).toHaveBeenCalledWith(
        expect.objectContaining({
          gasLimit: 100000,
          gasPrice: 0.00001,
        }),
      );
      expect(mockDispatcher.submit).toHaveBeenCalledWith(["0", "1"], false);
      expect(mockDispatcher.submitAndListen).not.toHaveBeenCalled();
    });

    test("deployContracts deploys multiple files", async () => {
      const contracts = ["token.pact", "exchange.pact", "governance.pact"];

      await client.deployContracts(contracts);

      expect(fs.readFile).toHaveBeenCalledTimes(3);
      expect(mockDispatcher.submitAndListen).toHaveBeenCalledTimes(3);
    });

    test("deployCode deploys raw code", async () => {
      const code = "(module direct-deploy ...)";

      await client.deployCode(code);

      expect(execution).toHaveBeenCalledWith(code, expect.any(Object));
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    test("handles deployment errors", async () => {
      mockDispatcher.submitAndListen.mockRejectedValue(new Error("Network error"));

      await expect(client.deployContract("failing.pact")).rejects.toThrow("Network error");
    });
  });

  describe("Transaction Building", () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test("execution creates transaction builder", () => {
      const builder = client.execution('(coin.details "alice")');

      expect(execution).toHaveBeenCalledWith('(coin.details "alice")', expect.any(Object));
      expect(builder).toBe(mockBuilder);
    });

    test("execution with data", () => {
      client.execution('(coin.transfer "alice" "bob" amount)').withDataMap({ amount: 10.0 });

      expect(mockBuilder.withDataMap).toHaveBeenCalledWith({ amount: 10.0 });
    });

    test("chainable builder methods", () => {
      const result = client
        .execution("(my-module.function)")
        .withMeta({ chainId: "0" })
        .withSigner({ pubKey: "key" })
        .withKeyset("ks", { keys: ["key"], pred: "keys-all" })
        .withDataMap({ value: 42 });

      expect(result).toBe(mockBuilder);
      expect(mockBuilder.withMeta).toHaveBeenCalledWith({ chainId: "0" });
      expect(mockBuilder.withSigner).toHaveBeenCalledWith({ pubKey: "key" });
      expect(mockBuilder.withKeyset).toHaveBeenCalledWith("ks", { keys: ["key"], pred: "keys-all" });
      expect(mockBuilder.withDataMap).toHaveBeenCalledWith({ value: 42 });
    });
  });

  describe("Transaction Execution", () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test("execution builder can submit transaction", async () => {
      const result = await client.execution("(+ 1 1)").build().submit();

      expect(result).toEqual({ requestKey: "request-key-123" });
      expect(mockDispatcher.submit).toHaveBeenCalled();
    });

    test("execution builder can submitAndListen", async () => {
      const result = await client.execution("(+ 1 1)").build().submitAndListen();

      expect(result).toEqual({ status: "success", data: {} });
      expect(mockDispatcher.submitAndListen).toHaveBeenCalled();
    });

    test("execution builder can execute locally", async () => {
      const result = await client.execution("(+ 1 1)").build().local();

      expect(result).toEqual({ status: "success", data: {} });
      expect(mockDispatcher.local).toHaveBeenCalled();
    });

    test("execution builder can perform dirtyRead", async () => {
      mockDispatcher.dirtyRead.mockResolvedValue(42);

      const result = await client.execution('(coin.get-balance "alice")').build().dirtyRead();

      expect(result).toBe(42);
      expect(mockDispatcher.dirtyRead).toHaveBeenCalled();
    });
  });

  describe("Module Management", () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test("listModules returns module list", async () => {
      mockDispatcher.dirtyRead.mockResolvedValue(["coin", "my-module"]);

      const modules = await client.listModules();

      expect(modules).toEqual(["coin", "my-module"]);
      expect(mockDispatcher.dirtyRead).toHaveBeenCalled();
    });

    test("describeModule returns module info", async () => {
      const moduleInfo = {
        name: "coin",
        hash: "module-hash",
        interfaces: ["fungible-v2"],
      };
      mockDispatcher.dirtyRead.mockResolvedValue(moduleInfo);

      const result = await client.describeModule("coin");

      expect(result).toEqual(moduleInfo);
      expect(mockDispatcher.dirtyRead).toHaveBeenCalled();
    });

    test("isContractDeployed checks deployment", async () => {
      mockDispatcher.dirtyRead.mockResolvedValueOnce({ module: "my-module" });

      const deployed = await client.isContractDeployed("my-module");

      expect(deployed).toBe(true);
      expect(mockDispatcher.dirtyRead).toHaveBeenCalled();
    });

    test("isContractDeployed returns false on error", async () => {
      mockDispatcher.dirtyRead.mockRejectedValue(new Error("Module not found"));

      const deployed = await client.isContractDeployed("missing-module");

      expect(deployed).toBe(false);
    });
  });

  describe("Namespace Management", () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test("describeNamespace returns namespace info", async () => {
      const nsInfo = {
        namespace: "free",
        guard: { keys: ["admin-key"], pred: "keys-all" },
      };
      mockDispatcher.dirtyRead.mockResolvedValue(nsInfo);

      const result = await client.describeNamespace("free");

      expect(result).toEqual(nsInfo);
      expect(mockDispatcher.dirtyRead).toHaveBeenCalled();
    });

    test("isNamespaceDefined checks namespace", async () => {
      mockDispatcher.dirtyRead.mockResolvedValueOnce({ namespace: "my-namespace" });

      const defined = await client.isNamespaceDefined("my-namespace");

      expect(defined).toBe(true);
    });
  });

  describe("File Management", () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test("getContractCode loads from contracts dir", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("(module code ...)");

      const code = await client.getContractCode("token.pact");

      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining("token.pact"), "utf-8");
      expect(code).toBe("(module code ...)");
    });

    test("getContractCode handles absolute paths", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("(module abs ...)");

      await client.getContractCode("/absolute/path/token.pact");

      expect(fs.readFile).toHaveBeenCalledWith("/absolute/path/token.pact", "utf-8");
    });

    test("getContractCode auto-adds .pact extension", async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error("Not found"));
      vi.mocked(fs.readFile).mockResolvedValue("(module ext ...)");

      await client.getContractCode("token");

      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining("token.pact"), "utf-8");
    });
  });

  describe("Multi-Chain Operations", () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test("executes on specific chains", async () => {
      const chainIds: ChainId[] = ["0", "1"];

      await client.deployContract("multi-chain.pact", {}, chainIds);

      // Verify submit was called with chain IDs
      expect(mockDispatcher.submitAndListen).toHaveBeenCalledWith(chainIds, undefined);
    });

    test("executes on all chains", async () => {
      const allChainIds: ChainId[] = ["0", "1", "2", "3"];

      await client.deployContract("all-chains.pact", {}, allChainIds);

      expect(mockDispatcher.submitAndListen).toHaveBeenCalledWith(allChainIds, undefined);
    });
  });

  describe("Error Handling", () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
    });

    test("handles file not found", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      await expect(client.deployContract("missing.pact")).rejects.toThrow("ENOENT");
    });

    test("handles network errors", async () => {
      mockDispatcher.submitAndListen.mockRejectedValue(new Error("Network timeout"));

      await expect(client.execution("(test)").build().submitAndListen()).rejects.toThrow("Network timeout");
    });

    test("handles invalid code", async () => {
      mockDispatcher.local.mockResolvedValue({
        status: "failure",
        error: {
          message: "Syntax error",
          type: "SyntaxError",
        },
      });

      const result = await client.execution("(invalid").build().local();

      expect((result as any).status).toBe("failure");
      expect((result as any).error.message).toBe("Syntax error");
    });
  });

  // Mock client tests removed - createMockClient doesn't exist in the actual API

  describe("Integration Patterns", () => {
    let client: PactToolboxClient;

    beforeEach(() => {
      client = new PactToolboxClient(mockConfig);
      vi.mocked(fs.readFile).mockResolvedValue("(module test ...)");
    });

    test("deploy and verify pattern", async () => {
      // Deploy
      await client.deployContract("my-module.pact");

      // Verify deployment
      mockDispatcher.dirtyRead.mockResolvedValue({ module: "my-module" });

      const deployed = await client.isContractDeployed("my-module");
      expect(deployed).toBe(true);

      // Execute function
      const result = await client.execution("(my-module.init)").build().submitAndListen();

      expect((result as any).status).toBe("success");
    });

    test("batch operations pattern", async () => {
      const operations = [
        '(coin.create-account "alice" (read-keyset "alice-ks"))',
        '(coin.create-account "bob" (read-keyset "bob-ks"))',
        '(coin.transfer "treasury" "alice" 1000.0)',
        '(coin.transfer "treasury" "bob" 1000.0)',
      ];

      const results = await Promise.all(
        operations.map((op) =>
          client
            .execution(op)
            .withDataMap({
              "alice-ks": { keys: ["alice-key"], pred: "keys-all" },
              "bob-ks": { keys: ["bob-key"], pred: "keys-all" },
            })
            .build()
            .submitAndListen(),
        ),
      );

      expect(results).toHaveLength(4);
      expect(mockDispatcher.submitAndListen).toHaveBeenCalledTimes(4);
    });
  });
});
