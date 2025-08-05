/**
 * WalletConnect wallet types
 */

/**
 * WalletConnect session structure
 */
export interface WalletConnectSession {
  topic: string;
  relay: {
    protocol: string;
  };
  expiry: number;
  namespaces: Record<string, WalletConnectNamespace>;
  requiredNamespaces: Record<string, WalletConnectNamespace>;
  optionalNamespaces: Record<string, WalletConnectNamespace>;
  sessionProperties?: Record<string, string>;
  peer: {
    publicKey: string;
    metadata: WalletConnectMetadata;
  };
  self: {
    publicKey: string;
    metadata: WalletConnectMetadata;
  };
}

/**
 * WalletConnect namespace structure
 */
export interface WalletConnectNamespace {
  accounts: string[];
  methods: string[];
  events: string[];
  chains?: string[];
}

/**
 * WalletConnect metadata
 */
export interface WalletConnectMetadata {
  name: string;
  description: string;
  url: string;
  icons: string[];
}

/**
 * WalletConnect configuration options
 */
export interface WalletConnectOptions {
  /** WalletConnect project ID */
  projectId: string;
  /** Relay server URL */
  relayUrl?: string;
  /** Network ID for Kadena */
  networkId?: string;
  /** App metadata */
  metadata?: WalletConnectMetadata;
  /** Optional pairing topic */
  pairingTopic?: string;
}

/**
 * WalletConnect connection parameters
 */
export interface WalletConnectConnectionParams {
  requiredNamespaces: Record<string, WalletConnectNamespace>;
  optionalNamespaces?: Record<string, WalletConnectNamespace>;
  pairingTopic?: string;
}

/**
 * WalletConnect request parameters
 */
export interface WalletConnectRequest {
  method: string;
  params: unknown;
}

/**
 * WalletConnect account request
 */
export interface WalletConnectAccountRequest {
  accounts: Array<{
    account: string;
    contracts?: string[];
  }>;
  contracts?: string[];
}

/**
 * WalletConnect sign request
 */
export interface WalletConnectSignRequest {
  chainId: string;
  request: {
    method: "kadena_sign_v1";
    params: unknown;
  };
}

/**
 * WalletConnect quicksign request
 */
export interface WalletConnectQuicksignRequest {
  chainId: string;
  request: {
    method: "kadena_quicksign_v1";
    params: {
      commandSigDatas: Array<{
        cmd: string;
        sigs: Array<{
          pubKey: string;
          sig: string | null;
        }>;
      }>;
    };
  };
}

/**
 * WalletConnect client interface
 */
export interface WalletConnectClient {
  connect(params: WalletConnectConnectionParams): Promise<{
    uri?: string;
    approval(): Promise<WalletConnectSession>;
  }>;
  
  disconnect(params: { topic: string; reason: { code: number; message: string } }): Promise<void>;
  
  request(params: {
    topic: string;
    chainId: string;
    request: {
      method: string;
      params: unknown;
    };
  }): Promise<unknown>;
  
  session: {
    getAll(): WalletConnectSession[];
    get(topic: string): WalletConnectSession;
  };
  
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * WalletConnect provider events
 */
export interface WalletConnectEvents {
  /** Session was successfully established */
  sessionConnected: (session: WalletConnectSession) => void;
  /** Session was disconnected */
  sessionDisconnected: () => void;
  /** Session was updated */
  sessionUpdated: (session: WalletConnectSession) => void;
  /** Connection URI generated for QR code */
  displayUri: (uri: string) => void;
  /** Modal state changed */
  modalStateChanged: (state: { open: boolean }) => void;
}

/**
 * Kadena chain ID format for WalletConnect
 */
export type WalletConnectChainId = `kadena:${string}`;

/**
 * WalletConnect quicksign response
 */
export interface WalletConnectQuicksignResponse {
  responses: Array<{
    commandSigData: {
      cmd: string;
      sigs: Array<{
        pubKey: string;
        sig: string;
      }>;
    };
    outcome: {
      result: "success" | "failure";
      hash?: string;
      msg?: string;
    };
  }>;
}