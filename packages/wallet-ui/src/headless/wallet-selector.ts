import type { WalletMetadata } from "@pact-toolbox/wallet-core";

/**
 * Headless wallet selector state and actions
 */
export interface WalletSelectorState {
  wallets: WalletMetadata[];
  loading: boolean;
  error: Error | null;
  selectedWallet: string | null;
  filter: string;
  filteredWallets: WalletMetadata[];
}

/**
 * Wallet selector actions
 */
export interface WalletSelectorActions {
  setWallets: (wallets: WalletMetadata[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  selectWallet: (walletId: string) => void;
  setFilter: (filter: string) => void;
  reset: () => void;
}

/**
 * Wallet selector render props
 */
export interface WalletSelectorRenderProps extends WalletSelectorState, WalletSelectorActions {
  // Computed properties
  hasWallets: boolean;
  isFiltered: boolean;
  canAutoConnect: boolean;
}

/**
 * Create headless wallet selector
 */
export function createWalletSelector(
  onSelect?: (walletId: string) => void,
  onAutoConnect?: () => void
): {
  state: WalletSelectorState;
  actions: WalletSelectorActions;
  getRenderProps: () => WalletSelectorRenderProps;
} {
  // Initialize state
  let state: WalletSelectorState = {
    wallets: [],
    loading: false,
    error: null,
    selectedWallet: null,
    filter: "",
    filteredWallets: [],
  };

  // Update filtered wallets
  const updateFilteredWallets = () => {
    const filter = state.filter.toLowerCase();
    state.filteredWallets = filter
      ? state.wallets.filter(w => 
          w.name.toLowerCase().includes(filter) ||
          w.description.toLowerCase().includes(filter)
        )
      : state.wallets;
  };

  // Actions
  const actions: WalletSelectorActions = {
    setWallets: (wallets) => {
      state.wallets = wallets;
      updateFilteredWallets();
    },
    setLoading: (loading) => {
      state.loading = loading;
    },
    setError: (error) => {
      state.error = error;
    },
    selectWallet: (walletId) => {
      state.selectedWallet = walletId;
      onSelect?.(walletId);
    },
    setFilter: (filter) => {
      state.filter = filter;
      updateFilteredWallets();
    },
    reset: () => {
      state = {
        wallets: [],
        loading: false,
        error: null,
        selectedWallet: null,
        filter: "",
        filteredWallets: [],
      };
    },
  };

  // Get render props
  const getRenderProps = (): WalletSelectorRenderProps => ({
    ...state,
    ...actions,
    hasWallets: state.wallets.length > 0,
    isFiltered: state.filter.length > 0,
    canAutoConnect: state.wallets.length > 0 && !!onAutoConnect,
  });

  return {
    state,
    actions,
    getRenderProps,
  };
}