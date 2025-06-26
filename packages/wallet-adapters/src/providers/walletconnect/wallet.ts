import type { PartiallySignedTransaction, SignedTransaction } from "@pact-toolbox/types";
import type { WalletAccount } from "@pact-toolbox/wallet-core";
import { WalletError } from "@pact-toolbox/wallet-core";
import type {
  WalletConnectOptions,
  WalletConnectSession,
  WalletConnectClient,
  WalletConnectModal,
  WalletConnectEvents,
  WalletConnectChainId,
  WalletConnectQuicksignResponse,
  WalletConnectMetadata,
} from "./types";

/**
 * WalletConnect wallet implementation
 */
import { BaseWallet } from "@pact-toolbox/wallet-core";

export class WalletConnectWallet extends BaseWallet {
  private client?: WalletConnectClient;
  private modal?: WalletConnectModal;
  private session?: WalletConnectSession;
  private currentAccounts: string[] = [];
  private options: WalletConnectOptions & { relayUrl: string; networkId: string; metadata: WalletConnectMetadata };
  private events: Partial<WalletConnectEvents> = {};

  constructor(options: WalletConnectOptions) {
    super();
    this.options = {
      projectId: options.projectId,
      relayUrl: options.relayUrl || "wss://relay.walletconnect.com",
      networkId: options.networkId || "mainnet01",
      metadata: options.metadata || {
        name: "Pact Toolbox",
        description: "Kadena development toolkit",
        url: "https://github.com/kadena-io/pact-toolbox",
        icons: ["https://avatars.githubusercontent.com/u/39153513"],
      },
      pairingTopic: options.pairingTopic,
    };
  }

  /**
   * Check if WalletConnect is available
   */
  isInstalled(): boolean {
    // WalletConnect doesn't require installation, it's a protocol
    return true;
  }

  /**
   * Initialize WalletConnect client
   */
  private async initializeClient(): Promise<void> {
    if (this.client) return;

    try {
      // Dynamic import to avoid bundling WalletConnect when not used
      const { SignClient } = await import("@walletconnect/sign-client");
      const { WalletConnectModal } = await import("@walletconnect/modal");

      this.client = await SignClient.init({
        relayUrl: this.options.relayUrl,
        projectId: this.options.projectId,
        metadata: this.options.metadata,
      }) as unknown as WalletConnectClient;

      this.modal = new WalletConnectModal({
        projectId: this.options.projectId,
        chains: [`kadena:${this.options.networkId}`],
      }) as unknown as WalletConnectModal;

      // Setup event listeners
      this.setupEventListeners();

      // Check for existing sessions
      const sessions = this.client?.session.getAll() || [];
      if (sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        if (lastSession) {
          this.session = lastSession; // Use most recent session
          this.onSessionConnected(lastSession);
        }
      }
    } catch (error) {
      throw WalletError.connectionFailed(
        `Failed to initialize WalletConnect: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Setup WalletConnect event listeners
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on("session_ping", (args) => {
      console.log("WalletConnect session ping:", args);
    });

    this.client.on("session_event", (args) => {
      console.log("WalletConnect session event:", args);
    });

    this.client.on("session_update", (...args: unknown[]) => {
      const [event] = args;
      if (event && typeof event === "object" && "topic" in event && "params" in event) {
        const eventData = event as { topic: string; params: { namespaces: unknown } };
        const session = this.client!.session.get(eventData.topic);
        const updatedSession = { ...session, namespaces: eventData.params.namespaces as any };
        this.onSessionConnected(updatedSession);
        this.events.sessionUpdated?.(updatedSession);
      }
    });

    this.client.on("session_delete", () => {
      this.session = undefined;
      this.currentAccounts = [];
      this.events.sessionDisconnected?.();
    });

    if (this.modal) {
      this.modal.subscribeModal((state) => {
        this.events.modalStateChanged?.(state);
      });
    }
  }

  /**
   * Handle session connection
   */
  private onSessionConnected(session: WalletConnectSession): void {
    this.session = session;

    // Extract accounts from namespaces
    const kadenaNamespace = session.namespaces[`kadena`] || session.namespaces[`kadena:${this.options.networkId}`];
    if (kadenaNamespace) {
      this.currentAccounts = kadenaNamespace.accounts.map((account) => {
        // Account format: "kadena:networkId:account"
        const parts = account.split(":");
        return parts.length >= 3 ? parts.slice(2).join(":") : account;
      });
    }

    this.events.sessionConnected?.(session);
  }

  /**
   * Connect to WalletConnect
   */
  async connect(networkId?: string): Promise<WalletAccount> {
    await this.initializeClient();

    if (!this.client) {
      throw WalletError.connectionFailed("Failed to initialize WalletConnect client");
    }

    try {
      const chainId: WalletConnectChainId = `kadena:${networkId || this.options.networkId}`;

      const { uri, approval } = await this.client.connect({
        pairingTopic: this.options.pairingTopic,
        requiredNamespaces: {
          kadena: {
            methods: ["kadena_getAccounts_v1", "kadena_getAccount_v1", "kadena_sign_v1", "kadena_quicksign_v1"],
            chains: [chainId],
            events: [],
            accounts: [], // Will be populated by wallet
          },
        },
      });

      if (uri) {
        this.events.displayUri?.(uri);
        this.modal?.openModal({ uri });
      }

      const session = await approval();
      this.modal?.closeModal();
      this.onSessionConnected(session);

      // Get the first account as primary signer
      if (this.currentAccounts.length === 0) {
        throw WalletError.connectionFailed("No accounts available");
      }

      const primaryAccount = this.currentAccounts[0];
      if (!primaryAccount) {
        throw WalletError.connectionFailed("No primary account available");
      }

      // Parse account to get public key if it's in k:publicKey format
      let publicKey = "";
      if (primaryAccount.startsWith("k:")) {
        publicKey = primaryAccount.slice(2);
      } else {
        // For non-k accounts, we'll need to request account details
        publicKey = primaryAccount; // Fallback
      }

      this.account = {
        address: primaryAccount,
        publicKey,
        balance: 0,
        connectedSites: [session.peer.metadata.url || ""],
      };
      this.connected = true;
      
      // Set up network info
      const networkId2 = networkId || this.options.networkId;
      const networks: Record<string, { name: string; url: string; explorer?: string }> = {
        mainnet01: {
          name: "Mainnet",
          url: "https://api.chainweb.com",
          explorer: "https://explorer.chainweb.com/mainnet",
        },
        testnet04: {
          name: "Testnet",
          url: "https://api.testnet.chainweb.com",
          explorer: "https://explorer.chainweb.com/testnet",
        },
        development: {
          name: "Development",
          url: "http://localhost:8080",
        },
      };

      const network = networks[networkId2] || networks["mainnet01"];
      this.network = {
        id: networkId2,
        networkId: networkId2,
        name: network!.name,
        url: network!.url,
        explorer: network!.explorer,
      };

      return this.account;
    } catch (error) {
      this.modal?.closeModal();

      if (error instanceof Error) {
        if (error.message.includes("User rejected") || error.message.includes("rejected")) {
          throw WalletError.userRejected("connection");
        }
      }
      throw WalletError.connectionFailed(error instanceof Error ? error.message : String(error));
    }
  }



  /**
   * Check if connected
   */
  async isConnected(_networkId?: string): Promise<boolean> {
    return !!(this.session && this.currentAccounts.length > 0);
  }



  /**
   * Disconnect from wallet
   */
  async disconnect(_networkId?: string): Promise<void> {
    if (this.session && this.client) {
      try {
        await this.client.disconnect({
          topic: this.session.topic,
          reason: {
            code: 6000,
            message: "User disconnected",
          },
        });
      } catch (error) {
        // Ignore disconnect errors
        console.warn("WalletConnect disconnect error:", error);
      }
    }

    await super.disconnect();
    this.session = undefined;
    this.currentAccounts = [];
    this.modal?.closeModal();
  }

  /**
   * Sign transaction(s) - uses quickSign internally for better performance
   */
  async sign(tx: PartiallySignedTransaction): Promise<SignedTransaction>;
  async sign(txs: PartiallySignedTransaction[]): Promise<SignedTransaction[]>;
  async sign(
    txs: PartiallySignedTransaction | PartiallySignedTransaction[],
  ): Promise<SignedTransaction | SignedTransaction[]> {
    if (!this.session || !this.client) {
      throw WalletError.notConnected("walletconnect");
    }

    const transactions = Array.isArray(txs) ? txs : [txs];

    try {
      const chainId: WalletConnectChainId = `kadena:${this.options.networkId}`;

      const result = await this.client.request({
        topic: this.session.topic,
        chainId,
        request: {
          method: "kadena_quicksign_v1",
          params: {
            commandSigDatas: transactions.map((tx) => ({
              cmd: tx.cmd,
              sigs: tx.sigs.map((sig) => ({
                pubKey: sig.pubKey || "",
                sig: sig.sig ?? null,
              })),
            })),
          },
        },
      });

      const response = result as WalletConnectQuicksignResponse;
      const signedTxs = response.responses.map((res, index: number) => {
        if (res.outcome.result !== "success") {
          throw new Error(res.outcome.msg || "Signing failed");
        }

        const tx = transactions[index]!;
        return {
          cmd: res.commandSigData.cmd,
          sigs: res.commandSigData.sigs,
          hash: res.outcome.hash || tx.hash || "",
        } as SignedTransaction;
      });

      return Array.isArray(txs) ? signedTxs : signedTxs[0]!;
    } catch (error) {
      if (error instanceof Error && (error.message.includes("User rejected") || error.message.includes("rejected"))) {
        throw WalletError.userRejected("signing");
      }
      throw WalletError.signingFailed(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Add event listener
   */
  on<K extends keyof WalletConnectEvents>(event: K, handler: WalletConnectEvents[K]): void {
    this.events[event] = handler;
  }

  /**
   * Remove event listener
   */
  off<K extends keyof WalletConnectEvents>(event: K): void {
    delete this.events[event];
  }
}
