import { createToken } from "./container";
import type { Wallet as WalletInterface } from "./wallet";
import type { SerializableNetworkConfig } from "./config";
import type {
  INetworkProvider,
  IWalletProvider,
  IWalletSystem,
  IWalletRegistry,
  IWalletPersistence,
  ITransactionDefaults,
  IChainwebClient,
  IStore,
  IModalManager,
  ILogger,
  ISignerResolver,
  ISignerProvider,
  IEventBus,
  IWalletManager,
} from "./interfaces";

// Import ServiceToken type from local container module
import type { ServiceToken } from "./container";

// Network and Configuration
export const NetworkConfig: ServiceToken<SerializableNetworkConfig> = createToken<SerializableNetworkConfig>("NetworkConfig");
export const NetworkProvider: ServiceToken<INetworkProvider> = createToken<INetworkProvider>("NetworkProvider");

// Wallet and Signing
export const Wallet: ServiceToken<WalletInterface> = createToken<WalletInterface>("Wallet");
export const WalletProvider: ServiceToken<IWalletProvider> = createToken<IWalletProvider>("WalletProvider");
export const WalletSystem: ServiceToken<IWalletSystem> = createToken<IWalletSystem>("WalletSystem");
export const WalletRegistry: ServiceToken<IWalletRegistry> = createToken<IWalletRegistry>("WalletRegistry");
export const WalletManager: ServiceToken<IWalletManager> = createToken<IWalletManager>("WalletManager");
export const SignerResolver: ServiceToken<ISignerResolver> = createToken<ISignerResolver>("SignerResolver");
export const SignerProvider: ServiceToken<ISignerProvider> = createToken<ISignerProvider>("SignerProvider");

// Transaction
export const TransactionDefaults: ServiceToken<ITransactionDefaults> = createToken<ITransactionDefaults>("TransactionDefaults");

// Clients
export const ChainwebClient: ServiceToken<IChainwebClient> = createToken<IChainwebClient>("ChainwebClient");

// Storage and Persistence
export const Store: ServiceToken<IStore> = createToken<IStore>("Store");
export const WalletPersistence: ServiceToken<IWalletPersistence> = createToken<IWalletPersistence>("WalletPersistence");

// UI Components (optional)
export const ModalManager: ServiceToken<IModalManager> = createToken<IModalManager>("ModalManager");

// Logging
export const Logger: ServiceToken<ILogger> = createToken<ILogger>("Logger");

// Event System
export const EventBus: ServiceToken<IEventBus> = createToken<IEventBus>("EventBus");

// Core Services - grouped for convenience
export const TOKENS: {
  readonly NetworkConfig: ServiceToken<SerializableNetworkConfig>;
  readonly NetworkProvider: ServiceToken<INetworkProvider>;
  readonly Wallet: ServiceToken<WalletInterface>;
  readonly WalletProvider: ServiceToken<IWalletProvider>;
  readonly WalletSystem: ServiceToken<IWalletSystem>;
  readonly WalletRegistry: ServiceToken<IWalletRegistry>;
  readonly WalletManager: ServiceToken<IWalletManager>;
  readonly SignerResolver: ServiceToken<ISignerResolver>;
  readonly SignerProvider: ServiceToken<ISignerProvider>;
  readonly TransactionDefaults: ServiceToken<ITransactionDefaults>;
  readonly ChainwebClient: ServiceToken<IChainwebClient>;
  readonly Store: ServiceToken<IStore>;
  readonly WalletPersistence: ServiceToken<IWalletPersistence>;
  readonly ModalManager: ServiceToken<IModalManager>;
  readonly Logger: ServiceToken<ILogger>;
  readonly EventBus: ServiceToken<IEventBus>;
} = {
  NetworkConfig,
  NetworkProvider,
  Wallet,
  WalletProvider,
  WalletSystem,
  WalletRegistry,
  WalletManager,
  SignerResolver,
  SignerProvider,
  TransactionDefaults,
  ChainwebClient,
  Store,
  WalletPersistence,
  ModalManager,
  Logger,
  EventBus,
} as const;
