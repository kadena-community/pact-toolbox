import { useState, useCallback, useEffect } from "react";
import type { WalletNetwork } from "@pact-toolbox/wallet-core";
import { KadenaNetworks } from "@pact-toolbox/wallet-core";
import { useWallet } from "./use-wallet";

// Define NetworkCapabilities locally for now
interface NetworkCapabilities {
  canSwitchNetwork: boolean;
  canAddNetwork: boolean;
  supportedNetworks: string[];
}

// Define a type for network-aware wallets
interface NetworkAwareWallet {
  switchNetwork?: (networkId: string) => Promise<void>;
  addNetwork?: (network: WalletNetwork) => Promise<void>;
  getCurrentNetwork?: () => Promise<WalletNetwork>;
  getNetworkCapabilities?: () => NetworkCapabilities;
}

// Define a type guard for network management support
function supportsNetworkManagement(wallet: unknown): wallet is NetworkAwareWallet {
  return (
    wallet !== null &&
    typeof wallet === "object" &&
    (("switchNetwork" in wallet && typeof (wallet as NetworkAwareWallet).switchNetwork === "function") ||
      ("addNetwork" in wallet && typeof (wallet as NetworkAwareWallet).addNetwork === "function"))
  );
}

/**
 * Network management hook
 */
export interface UseNetworkReturn {
  /** Current network */
  network: WalletNetwork | null;
  /** Available networks */
  networks: WalletNetwork[];
  /** Network capabilities */
  capabilities: NetworkCapabilities | null;
  /** Switch network */
  switchNetwork: (networkId: string) => Promise<void>;
  /** Add custom network */
  addNetwork: (network: WalletNetwork) => Promise<void>;
  /** Check if network switching is supported */
  canSwitchNetwork: boolean;
  /** Check if adding networks is supported */
  canAddNetwork: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * React hook for network management
 */
export function useNetwork(): UseNetworkReturn {
  const { wallet } = useWallet();
  const [network, setNetwork] = useState<WalletNetwork | null>(null);
  const [capabilities, setCapabilities] = useState<NetworkCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load current network and capabilities
  useEffect(() => {
    if (!wallet) {
      setNetwork(null);
      setCapabilities(null);
      return;
    }

    async function loadNetwork() {
      if (!wallet) return;

      try {
        // Get current network
        const currentNetwork = await wallet.getNetwork();
        setNetwork(currentNetwork);

        // Get capabilities if supported
        if (supportsNetworkManagement(wallet)) {
          const caps = wallet.getNetworkCapabilities?.() || {
            canSwitchNetwork: false,
            canAddNetwork: false,
            supportedNetworks: [currentNetwork.networkId],
          };
          setCapabilities(caps);
        } else {
          setCapabilities({
            canSwitchNetwork: false,
            canAddNetwork: false,
            supportedNetworks: [currentNetwork.networkId],
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }

    loadNetwork();
  }, [wallet]);

  // Switch network
  const switchNetwork = useCallback(
    async (networkId: string) => {
      if (!wallet || !supportsNetworkManagement(wallet)) {
        throw new Error("Network switching not supported");
      }

      setIsLoading(true);
      setError(null);

      try {
        if (wallet.switchNetwork) {
          await wallet.switchNetwork(networkId);
          if (wallet.getCurrentNetwork) {
            const newNetwork = await wallet.getCurrentNetwork();
            setNetwork(newNetwork);
          }
        } else {
          throw new Error("Network switching not implemented");
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet],
  );

  // Add network
  const addNetwork = useCallback(
    async (network: WalletNetwork) => {
      if (!wallet || !supportsNetworkManagement(wallet)) {
        throw new Error("Adding networks not supported");
      }

      setIsLoading(true);
      setError(null);

      try {
        if (wallet.addNetwork) {
          await wallet.addNetwork(network);
        } else {
          throw new Error("Adding networks not implemented");
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet],
  );

  // Get available networks
  const networks =
    capabilities?.supportedNetworks
      .map((id: string) => KadenaNetworks[id])
      .filter((network): network is WalletNetwork => network !== undefined) || [];

  return {
    network,
    networks,
    capabilities,
    switchNetwork,
    addNetwork,
    canSwitchNetwork: capabilities?.canSwitchNetwork || false,
    canAddNetwork: capabilities?.canAddNetwork || false,
    isLoading,
    error,
  };
}
