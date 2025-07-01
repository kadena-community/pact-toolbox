import { createSignal, onMount, onCleanup, JSX } from "solid-js";
import { css } from "goober";
import { PactButton, truncateAddress, PactModal } from "@pact-toolbox/ui-shared";
import { WalletSelector } from "./wallet-selector";
import { getWalletManager } from "../utils";

interface Wallet {
  id?: string;
  getAccount: () => Promise<WalletAccount>;
}

interface WalletAccount {
  address: string;
  publicKey?: string;
  balance?: number;
}

const accountInfoStyles = css`
  display: flex;
  align-items: center;
  gap: var(--pact-spacing-sm);
  padding: var(--pact-spacing-sm) var(--pact-spacing-md);
  background: var(--pact-color-bg-secondary);
  border: var(--pact-border-width) solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-base);
  font-size: var(--pact-font-size-sm);
`;

const accountAddressStyles = css`
  font-family: var(--pact-font-family-mono);
  color: var(--pact-color-text-primary);
`;

const accountBalanceStyles = css`
  color: var(--pact-color-text-secondary);
`;

const walletIconStyles = css`
  width: 20px;
  height: 20px;
  border-radius: var(--pact-border-radius-sm);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--pact-color-bg-primary);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export function WalletConnectButton(): JSX.Element {
  const [wallet, setWallet] = createSignal<Wallet | null>(null);
  const [account, setAccount] = createSignal<WalletAccount | null>(null);
  const [showModal, setShowModal] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  let walletManager: any;

  const handleWalletConnected = async (connectedWallet: Wallet) => {
    setWallet(connectedWallet);
    await loadAccount();
    setShowModal(false);
  };

  const handleWalletDisconnected = () => {
    setWallet(null);
    setAccount(null);
  };

  const loadAccount = async () => {
    const currentWallet = wallet();
    if (!currentWallet) return;

    setLoading(true);
    try {
      const accountData = await currentWallet.getAccount();
      setAccount(accountData);
    } catch (error) {
      console.error("Failed to load account:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    setShowModal(true);
  };

  const handleDisconnect = async () => {
    const currentWallet = wallet();
    if (!currentWallet) return;

    try {
      const walletId = currentWallet.id;
      if (walletId && walletManager) {
        await walletManager.disconnect(walletId);
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  onMount(async () => {
    try {
      walletManager = await getWalletManager();

      // Check if already connected
      const primaryWallet = walletManager.getPrimaryWallet();
      if (primaryWallet) {
        setWallet(primaryWallet);
        await loadAccount();
      }

      // Listen for wallet events
      walletManager.on("connected", handleWalletConnected);
      walletManager.on("disconnected", handleWalletDisconnected);
    } catch (error) {
      console.debug("Wallet manager not available yet:", error);
    }
  });

  onCleanup(() => {
    if (walletManager) {
      walletManager.off("connected", handleWalletConnected);
      walletManager.off("disconnected", handleWalletDisconnected);
    }
  });

  const currentWallet = wallet();
  const currentAccount = account();

  if (currentWallet && currentAccount) {
    return (
      <div class={accountInfoStyles}>
        <div class={walletIconStyles}>
          <span>👛</span>
        </div>
        <span class={accountAddressStyles}>{truncateAddress(currentAccount.address)}</span>
        {currentAccount.balance !== undefined && (
          <span class={accountBalanceStyles}>{currentAccount.balance} KDA</span>
        )}
        <PactButton variant="ghost" size="sm" onClick={handleDisconnect}>
          Disconnect
        </PactButton>
      </div>
    );
  }

  return (
    <>
      <PactButton variant="primary" onClick={handleConnect} loading={loading()}>
        Connect Wallet
      </PactButton>

      <PactModal open={showModal()} title="Connect Wallet" onClose={() => setShowModal(false)} maxWidth="sm">
        <WalletSelector onWalletConnected={() => setShowModal(false)} />
      </PactModal>
    </>
  );
}
