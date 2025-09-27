/**
 * Modern SolidJS store for wallet state management
 * Replaces old service-based approach with proper SolidJS patterns
 */

import { createStore, produce } from 'solid-js/store';
import { createSignal } from 'solid-js';
import type { Account, Network, Transaction, WalletScreen, DevWalletSettings, PendingTransaction } from '../types';
import { DevWalletStorage } from '../storage';
import { EventEmitter } from '@pact-toolbox/utils';
import { NetworkConfigProvider } from '@pact-toolbox/network-config';
import { CoinContract } from '@pact-toolbox/kda';
import type { ChainId } from '@pact-toolbox/types';
import { getGlobalRegistry } from '../keypair-registry';

interface WalletEvents {
  'account-selected': (account: Account) => void;
  'account-created': (account: Account) => void;
  'network-changed': (network: Network) => void;
  'transaction-signed': (transaction: Transaction) => void;
  'transaction-rejected': (reason: string) => void;
  'wallet-locked': (timestamp: number) => void;
  'wallet-unlocked': (timestamp: number) => void;
  'settings-changed': (settings: DevWalletSettings) => void;
  'wallet-data-cleared': () => void;
  'wallet-export-requested': () => void;
  'connect-requested': () => void;
  'sign-requested': (transaction: PendingTransaction) => void;
  'connect-approved': (account: Account) => void;
  'connect-cancelled': () => void;
  'sign-approved': (transaction?: PendingTransaction) => void;
  'sign-rejected': () => void;
  'close-wallet': () => void;
  'navigation': (screen: WalletScreen) => void;
  'transaction-added': (transaction: Transaction) => void;
  'transaction-updated': (transactionId: string, status: string, result?: any) => void;
}

// Create global instance for wallet events
export const walletEventEmitter = new EventEmitter<WalletEvents>();

export interface WalletState {
  currentScreen: WalletScreen;
  accounts: Account[];
  transactions: Transaction[];
  networks: Network[];
  selectedAccount?: Account;
  activeNetwork?: Network;
  pendingTransaction?: PendingTransaction;
  isConnecting: boolean;
  settings: DevWalletSettings;
  isLocked: boolean;
  lastActivity: number;
}

const defaultState: WalletState = {
  currentScreen: 'transactions',
  accounts: [],
  transactions: [],
  networks: [],
  isConnecting: false,
  settings: {
    autoLock: false,
    showTestNetworks: true,
  },
  isLocked: false,
  lastActivity: Date.now(),
};

// Create the main store
export const [walletState, setWalletState] = createStore<WalletState>(defaultState);
export const [isInitialized, setIsInitialized] = createSignal(false);

// Storage singleton
let storage: DevWalletStorage | null = null;
let coinContract: CoinContract | null = null;

export function getWalletStorage(): DevWalletStorage {
  if (!storage) {
    storage = new DevWalletStorage();
  }
  return storage;
}

function getCoinContract(): CoinContract {
  if (!coinContract) {
    const networkProvider = NetworkConfigProvider.getInstance();
    coinContract = new CoinContract(networkProvider);
  }
  return coinContract;
}

// Initialize the store
export async function initializeWalletStore() {
  try {
    const storageInstance = getWalletStorage();
    // Load settings
    const settings = await storageInstance.getSettings();

    // Load networks (from global context or defaults)
    const networks = await loadNetworks();
    const activeNetwork = networks.find(n => n.isActive) || networks[0];

    // Load accounts for the active network
    let accounts: Account[] = [];
    if (activeNetwork) {
      accounts = await storageInstance.getAccountsForNetwork(activeNetwork.id);

      // If no network-specific accounts, migrate from old storage
      if (accounts.length === 0) {
        const storedKeys = await storageInstance.getKeys();
        accounts = storedKeys.map(key => ({
          address: key.address,
          publicKey: key.publicKey,
          privateKey: key.privateKey,
          name: key.name || 'Account',
          chainId: '0',
          balance: 0,
          networkId: activeNetwork.id,
        }));

        // Save migrated accounts to network-specific storage
        for (const account of accounts) {
          await storageInstance.saveAccountForNetwork(activeNetwork.id, account);
        }
      }

      // Fetch balances for accounts
      accounts = await refreshAccountBalances(accounts);
    }

    // Load transactions
    const devWalletTransactions = await storageInstance.getTransactions();
    const transactions = devWalletTransactions.map(tx => ({
      id: tx.id,
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      gas: tx.gas,
      status: tx.status,
      timestamp: tx.timestamp,
      chainId: tx.chainId,
      capability: tx.capability,
      data: tx.data,
    }));

    // Get selected account for active network
    let selectedAccount: Account | undefined;
    if (activeNetwork) {
      const selectedAddress = await storageInstance.getSelectedAccountForNetwork(activeNetwork.id);
      if (selectedAddress) {
        selectedAccount = accounts.find(a => a.address === selectedAddress);
      }
    }

    // Create copies to avoid reference issues
    const accountsCopy = accounts.map(acc => ({ ...acc }));
    const selectedAccountCopy = selectedAccount ? { ...selectedAccount } : (accounts[0] ? { ...accounts[0] } : undefined);

    setWalletState(produce(state => {
      state.settings = settings;
      state.accounts = accountsCopy;
      state.networks = networks;
      state.activeNetwork = activeNetwork;
      state.selectedAccount = selectedAccountCopy;
      state.transactions = transactions;
    }));

    setIsInitialized(true);
  } catch (error) {
    console.error('Failed to initialize wallet store:', error);
  }
}

// Helper function to refresh account balances from blockchain
// Returns a new array with updated accounts to avoid mutations
async function refreshAccountBalances(accounts: Account[]): Promise<Account[]> {
  const coin = getCoinContract();

  // Create a new array with copied accounts to avoid mutations
  const updatedAccounts = await Promise.all(
    accounts.map(async (account) => {
      // Create a copy of the account
      const updatedAccount = { ...account };

      try {
        // Fetch balance for the account
        const balance = await coin.getBalance(updatedAccount.address, {
          chainId: (updatedAccount.chainId || '0') as ChainId,
        });

        // Check if account exists on chain
        const exists = await coin.accountExists(updatedAccount.address, {
          chainId: (updatedAccount.chainId || '0') as ChainId,
        });

        // Update the copy with fetched data
        updatedAccount.balance = balance;
        updatedAccount.existsOnChain = exists;

        // If account exists, get its details including guard
        if (exists) {
          try {
            const details = await coin.getAccountDetails(updatedAccount.address, {
              chainId: (updatedAccount.chainId || '0') as ChainId,
            });
            updatedAccount.guard = details.guard as unknown as Record<string, unknown>;
          } catch (error) {
            console.error(`Failed to get details for ${updatedAccount.address}:`, error);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch balance for ${updatedAccount.address}:`, error);
        updatedAccount.balance = '0';
        updatedAccount.existsOnChain = false;
      }

      return updatedAccount;
    })
  );

  return updatedAccounts;
}

async function loadNetworks(): Promise<Network[]> {
  try {
    // Get network config from NetworkConfigProvider
    const provider = NetworkConfigProvider.getInstance();
    const multiConfig = provider.getMultiNetworkConfig();
    const currentNetworkId = multiConfig.default || "development";

    // Load stored custom networks
    const storage = getWalletStorage();
    const customNetworks = await storage.getCustomNetworks();

    // Convert configured networks to our Network type
    const networks: Network[] = [];

    // Add configured networks
    for (const [id, config] of Object.entries(multiConfig.configs)) {
      networks.push({
        id,
        name: config.name || id,
        chainId: config.meta?.chainId?.toString() || "0",
        rpcUrl: config.rpcUrl || "http://localhost:8080",
        isActive: id === currentNetworkId,
        isCustom: false,
      });
    }

    // Add custom networks from storage
    for (const customNet of customNetworks) {
      networks.push({
        ...customNet,
        isActive: false,
        isCustom: true,
      });
    }

    return networks;
  } catch (error) {
    console.error('Failed to load networks:', error);
    // Default fallback
    return [{
      id: "development",
      name: "Development",
      chainId: "0",
      rpcUrl: "http://localhost:8080",
      isActive: true,
      isCustom: false,
    }];
  }
}

// Actions
export const walletActions = {
  setCurrentScreen(screen: WalletScreen) {
    setWalletState('currentScreen', screen);
    walletEventEmitter.emit('navigation', screen);
  },

  async selectAccount(account: Account) {
    // Create a copy to avoid reference issues
    const accountCopy = { ...account };
    setWalletState('selectedAccount', accountCopy);

    // Save selected account for the network
    const activeNetwork = walletState.activeNetwork;
    if (activeNetwork) {
      await getWalletStorage().setSelectedAccountForNetwork(activeNetwork.id, account.address);
    }

    walletEventEmitter.emit('account-selected', accountCopy);
  },

  async addAccount(account: Account) {
    const activeNetwork = walletState.activeNetwork;
    if (!activeNetwork) {
      console.error('No active network');
      return;
    }

    // Create a deep copy of the account to avoid reference issues
    const accountCopy = {
      ...account,
      networkId: activeNetwork.id,
    };

    setWalletState(produce(state => {
      state.accounts.push(accountCopy);
      if (state.accounts.length === 1) {
        state.selectedAccount = { ...accountCopy };
      }
    }));

    // Save to network-specific storage
    await getWalletStorage().saveAccountForNetwork(activeNetwork.id, accountCopy);

    // Also save the key for wallet compatibility
    await getWalletStorage().saveKey({
      address: account.address,
      publicKey: account.publicKey,
      privateKey: account.privateKey || '',
      name: account.name,
      createdAt: Date.now(),
    });

    walletEventEmitter.emit('account-created', accountCopy);
  },

  async deleteAccount(address: string) {
    const activeNetwork = walletState.activeNetwork;
    if (!activeNetwork) {
      console.error('No active network');
      return;
    }

    setWalletState(produce(state => {
      state.accounts = state.accounts.filter(a => a.address !== address);
      if (state.selectedAccount?.address === address) {
        state.selectedAccount = state.accounts[0];
      }
    }));

    // Remove from network-specific storage
    await getWalletStorage().removeAccountFromNetwork(activeNetwork.id, address);

    // Also remove from key storage
    await getWalletStorage().removeKey(address);
  },

  async changeNetwork(network: Network) {
    setWalletState(produce(state => {
      state.networks.forEach(n => n.isActive = false);
      const targetNetwork = state.networks.find(n => n.id === network.id);
      if (targetNetwork) {
        targetNetwork.isActive = true;
        state.activeNetwork = targetNetwork;
      }
    }));

    // Load accounts for the new network
    let accounts = await getWalletStorage().getAccountsForNetwork(network.id);

    // Refresh balances for loaded accounts
    accounts = await refreshAccountBalances(accounts);

    // Get selected account for this network
    const selectedAddress = await getWalletStorage().getSelectedAccountForNetwork(network.id);
    const selectedAccount = selectedAddress
      ? accounts.find(a => a.address === selectedAddress)
      : accounts[0];

    // Create fresh copies for state to avoid reference issues
    const accountsCopy = accounts.map(acc => ({ ...acc }));
    const selectedAccountCopy = selectedAccount ? { ...selectedAccount } : undefined;

    setWalletState(produce(state => {
      state.accounts = accountsCopy;
      state.selectedAccount = selectedAccountCopy;
    }));

    walletEventEmitter.emit('network-changed', network);
  },

  addTransaction(transaction: Transaction) {
    setWalletState(produce(state => {
      state.transactions.unshift(transaction);
    }));

    // Save to storage
    getWalletStorage().saveTransaction({
      id: transaction.id,
      hash: transaction.hash,
      from: transaction.from,
      to: transaction.to,
      amount: transaction.amount,
      gas: transaction.gas,
      status: transaction.status,
      timestamp: transaction.timestamp,
      chainId: transaction.chainId,
      capability: transaction.capability,
      data: transaction.data,
    });

    walletEventEmitter.emit('transaction-added', transaction);
  },

  updateTransactionStatus(transactionId: string, status: string, result?: any) {
    setWalletState(produce(state => {
      const tx = state.transactions.find(t => t.id === transactionId);
      if (tx) {
        tx.status = status as "pending" | "success" | "failure";
        tx.result = result;
      }
    }));

    walletEventEmitter.emit('transaction-updated', transactionId, status, result);
  },

  setPendingTransaction(transaction?: PendingTransaction) {
    setWalletState('pendingTransaction', transaction);
    if (transaction) {
      setWalletState('currentScreen', 'sign');
    }
  },

  setConnecting(connecting: boolean) {
    setWalletState('isConnecting', connecting);
    if (connecting) {
      setWalletState('currentScreen', 'connect');
    }
  },

  updateSettings(newSettings: Partial<DevWalletSettings>) {
    setWalletState(produce(state => {
      Object.assign(state.settings, newSettings);
    }));

    // Save to storage
    getWalletStorage().saveSettings(walletState.settings);

    walletEventEmitter.emit('settings-changed', walletState.settings);
  },

  clearAllData() {
    setWalletState(produce(state => {
      state.accounts = [];
      state.transactions = [];
      state.selectedAccount = undefined;
    }));

    getWalletStorage().clearAllData();
    walletEventEmitter.emit('wallet-data-cleared');
  },

  exportData() {
    walletEventEmitter.emit('wallet-export-requested');
  },

  lock() {
    setWalletState('isLocked', true);
    setWalletState('selectedAccount', undefined);
    walletEventEmitter.emit('wallet-locked', Date.now());
  },

  unlock() {
    setWalletState('isLocked', false);
    setWalletState('lastActivity', Date.now());
    walletEventEmitter.emit('wallet-unlocked', Date.now());
  },

  updateActivity() {
    setWalletState('lastActivity', Date.now());
  },

  async createAccountOnChain(account: Account) {
    const activeNetwork = walletState.activeNetwork;
    if (!activeNetwork) {
      throw new Error('No active network');
    }

    if (!account.privateKey) {
      throw new Error('Private key required to create account on chain');
    }

    const coin = getCoinContract();
    const chainId = (account.chainId || '0') as ChainId;

    try {
      // Use registry to get or create wallet for this account
      const registry = getGlobalRegistry();
      const wallet = await registry.createWalletFromPrivateKey(account.privateKey, {
        networkId: activeNetwork.id,
        rpcUrl: activeNetwork.rpcUrl,
        accountName: account.address,
      });

      // Create a keyset guard for the account
      const guard = {
        keys: [account.publicKey],
        pred: 'keys-all' as const,
      };

      // Create account on blockchain with the wallet
      await coin.createAccount({
        account: account.address,
        guard,
        chainId,
        wallet, // Pass the KeypairWallet
      });

      // Create updated account copy with new status
      const updatedAccount = {
        ...account,
        existsOnChain: true,
        guard,
      };

      // Update in storage
      await getWalletStorage().saveAccountForNetwork(activeNetwork.id, updatedAccount);

      // Update state
      setWalletState(produce(state => {
        const index = state.accounts.findIndex(a => a.address === account.address);
        if (index >= 0) {
          state.accounts[index] = updatedAccount;
        }
      }));

      return true;
    } catch (error) {
      console.error('Failed to create account on chain:', error);
      throw error;
    }
  },

  async discoverAccounts(publicKey: string) {
    const activeNetwork = walletState.activeNetwork;
    if (!activeNetwork) {
      throw new Error('No active network');
    }

    const coin = getCoinContract();

    try {
      // Discover accounts across chains
      const discovered = await coin.discoverAccounts({
        publicKey,
        chains: Array.from({ length: 20 }, (_, i) => i.toString() as ChainId),
      });

      // Process discovered accounts
      const accounts: Account[] = [];
      for (const item of discovered) {
        const existingAccount = walletState.accounts.find(
          a => a.address === item.account && a.chainId === item.chainId
        );

        if (!existingAccount) {
          // Create new account entry
          const account: Account = {
            address: item.account,
            publicKey,
            name: `Discovered (Chain ${item.chainId})`,
            chainId: item.chainId,
            balance: item.balance,
            networkId: activeNetwork.id,
            existsOnChain: true,
            discoveredChains: [item.chainId],
          };

          accounts.push(account);
          await getWalletStorage().saveAccountForNetwork(activeNetwork.id, account);
        } else {
          // Update existing account
          existingAccount.balance = item.balance;
          existingAccount.discoveredChains = existingAccount.discoveredChains || [];
          if (!existingAccount.discoveredChains.includes(item.chainId)) {
            existingAccount.discoveredChains.push(item.chainId);
          }
          await getWalletStorage().saveAccountForNetwork(activeNetwork.id, existingAccount);
        }
      }

      // Update state with new accounts
      if (accounts.length > 0) {
        setWalletState(produce(state => {
          state.accounts.push(...accounts);
        }));
      }

      return discovered;
    } catch (error) {
      console.error('Failed to discover accounts:', error);
      throw error;
    }
  },

  async refreshAccountBalance(account: Account) {
    const activeNetwork = walletState.activeNetwork;
    if (!activeNetwork) {
      return;
    }

    const coin = getCoinContract();
    const chainId = (account.chainId || '0') as ChainId;

    try {
      const balance = await coin.getBalance(account.address, { chainId });
      const exists = await coin.accountExists(account.address, { chainId });

      // Create a copy of the account to avoid mutations
      const updatedAccount = {
        ...account,
        balance,
        existsOnChain: exists,
      };

      if (exists) {
        const details = await coin.getAccountDetails(account.address, { chainId });
        updatedAccount.guard = details.guard as unknown as Record<string, unknown>;
      }

      // Save to storage
      await getWalletStorage().saveAccountForNetwork(activeNetwork.id, updatedAccount);

      // Update state
      setWalletState(produce(state => {
        const index = state.accounts.findIndex(a => a.address === account.address);
        if (index >= 0) {
          state.accounts[index] = updatedAccount;
        }
      }));
    } catch (error) {
      console.error(`Failed to refresh balance for ${account.address}:`, error);
    }
  },

  async refreshAllBalances() {
    const activeNetwork = walletState.activeNetwork;
    if (!activeNetwork) {
      return;
    }

    const accounts = [...walletState.accounts];
    const updatedAccounts = await refreshAccountBalances(accounts);

    // Update state with refreshed accounts
    setWalletState(produce(state => {
      state.accounts = updatedAccounts;
    }));

    // Save updated accounts to storage
    for (const account of updatedAccounts) {
      await getWalletStorage().saveAccountForNetwork(activeNetwork.id, account);
    }
  },
};

// Debug: expose wallet state globally
if (typeof window !== 'undefined') {
  interface DevWindow extends Window {
    __walletState?: typeof walletState;
    __walletActions?: typeof walletActions;
  }
  (window as DevWindow).__walletState = walletState;
  (window as DevWindow).__walletActions = walletActions;
}