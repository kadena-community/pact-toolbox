import { createSignal, onMount, For, Show, JSX, createEffect } from "solid-js";
import { css } from "goober";
import { PactButton, PactSpinner, PactCard, PactBadge, useToast } from "@pact-toolbox/ui-shared";
import { formatWalletError } from "@pact-toolbox/wallet-core";
import { getWalletManager } from "../utils";

interface WalletMetadata {
  id: string;
  name: string;
  icon?: string;
  description: string;
  installed?: boolean;
  downloadUrl?: string;
}

const walletGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--pact-spacing-4);
  margin-top: var(--pact-spacing-6);
`;

const walletCardStyles = css`
  position: relative;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--pact-spacing-3);
  cursor: pointer;
  text-align: center;
  transition: all var(--pact-transition-base) var(--pact-transition-timing);

  &.connected {
    border-color: var(--pact-color-success-light);
    background: var(--pact-color-success-lighter);

    &:hover {
      border-color: var(--pact-color-success);
    }
  }
`;

const connectedBadgeStyles = css`
  position: absolute;
  top: var(--pact-spacing-2);
  right: var(--pact-spacing-2);
`;

const walletIconStyles = css`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  border-radius: var(--pact-border-radius-lg);
  background: var(--pact-color-bg-accent);
  box-shadow: var(--pact-shadow-sm);

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: var(--pact-border-radius-md);
  }
`;

const walletNameStyles = css`
  font-size: var(--pact-font-size-base);
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-text-primary);
  line-height: 1.2;
`;

const walletDescriptionStyles = css`
  font-size: var(--pact-font-size-xs);
  color: var(--pact-color-text-secondary);
  margin-top: var(--pact-spacing-1);
`;

const loadingContainerStyles = css`
  text-align: center;
  padding: var(--pact-spacing-xl) 0;
  color: var(--pact-color-text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--pact-spacing-md);
`;

const autoConnectStyles = css`
  width: 100%;
  margin-bottom: var(--pact-spacing-4);
`;

const noWalletsStyles = css`
  text-align: center;
  padding: var(--pact-spacing-8) 0;

  svg {
    width: 64px;
    height: 64px;
    color: var(--pact-color-text-tertiary);
    margin-bottom: var(--pact-spacing-4);
  }

  h3 {
    font-size: var(--pact-font-size-lg);
    font-weight: var(--pact-font-weight-semibold);
    color: var(--pact-color-text-primary);
    margin: 0 0 var(--pact-spacing-2) 0;
  }

  p {
    font-size: var(--pact-font-size-sm);
    color: var(--pact-color-text-secondary);
    margin: 0;
  }
`;

interface WalletSelectorProps {
  onWalletConnected?: () => void;
  walletManager?: any;
  description?: string;
}

export function WalletSelector(props: WalletSelectorProps): JSX.Element {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<unknown>(null);
  const [wallets, setWallets] = createSignal<WalletMetadata[]>([]);
  const [connectedWalletIds, setConnectedWalletIds] = createSignal<string[]>([]);
  const { showToast } = useToast();

  const loadWallets = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use prop walletManager if provided, otherwise try to get global
      let walletManager = props.walletManager;

      // If no prop, try to get from window directly first
      if (!walletManager && typeof window !== "undefined" && (window as any).__PACT_WALLET_MANAGER__) {
        walletManager = (window as any).__PACT_WALLET_MANAGER__;
      }

      // Fall back to getWalletManager if still not found
      if (!walletManager) {
        try {
          walletManager = await getWalletManager();
        } catch (err) {
          // Don't treat this as an error if we can't find the wallet manager
        }
      }

      // Check if walletManager has the method we need
      if (!walletManager) {
        setWallets([]);
      } else if (!walletManager.getAvailableWallets) {
        setWallets([]);
      } else {
        const availableWallets = walletManager.getAvailableWallets();
        setWallets(availableWallets || []);
      }

      if (walletManager) {
        await updateConnectionStatus();
      }
    } catch (err) {
      // Only show error if it's not a wallet manager not found error
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (!errorMessage.includes("Wallet manager not found")) {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Show toast when error changes
  createEffect(() => {
    const currentError = error();
    if (currentError) {
      const errorInfo = formatWalletError(currentError);
      showToast({
        variant: "error",
        title: errorInfo.title,
        message: errorInfo.message,
        duration: 0, // Don't auto-dismiss errors
        position: "bottom-right",
        actions: errorInfo.retryable ? (
          <PactButton variant="primary" size="sm" onClick={loadWallets}>
            Try Again
          </PactButton>
        ) : undefined,
      });
    }
  });

  const updateConnectionStatus = async () => {
    try {
      const walletManager = props.walletManager || (await getWalletManager());
      const connectedWallets = walletManager.getConnectedWallets ? walletManager.getConnectedWallets() : [];
      setConnectedWalletIds(connectedWallets.map((w: any) => w.id || ""));
    } catch (error) {
      // Silently fail
    }
  };

  const selectWallet = (_walletId: string) => {
    // Emit wallet selection event for parent components
    if (props.onWalletConnected) {
      props.onWalletConnected();
    }
  };

  const handleAutoConnect = () => {
    // Handle auto-connect logic
    if (props.onWalletConnected) {
      props.onWalletConnected();
    }
  };

  const getWalletIcon = (metadata: WalletMetadata): JSX.Element => {
    const icons: Record<string, JSX.Element> = {
      ecko: <span style="font-size: 32px">🦎</span>,
      chainweaver: <span style="font-size: 32px">⛓️</span>,
      zelcore: <span style="font-size: 32px">💎</span>,
      walletconnect: <span style="font-size: 32px">🔗</span>,
      keypair: <span style="font-size: 32px">🔐</span>,
      magic: <span style="font-size: 32px">✨</span>,
    };
    return icons[metadata.id] || <span style="font-size: 32px">💳</span>;
  };

  onMount(() => {
    loadWallets();
  });

  return (
    <Show
      when={!loading()}
      fallback={
        <div class={loadingContainerStyles}>
          <PactSpinner size="md" />
          <p>Loading available wallets...</p>
        </div>
      }
    >
      {/* Always show content - errors are handled via toast */}
      <div>
        <Show
          when={wallets().length > 0}
          fallback={
            <div class={noWalletsStyles}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M21 12a2.25 2.25 0 00-.818-1.745l-9.382-7.756a2.25 2.25 0 00-2.958.076L3.364 7.5A2.25 2.25 0 002.5 9.318V19.25a2.25 2.25 0 002.25 2.25h14.5a2.25 2.25 0 002.25-2.25V12z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M16 12v3.75a.75.75 0 01-.75.75h-6.5a.75.75 0 01-.75-.75V12"
                />
              </svg>
              <h3>No wallets detected</h3>
              <p>Install a wallet extension or use the development wallet.</p>
            </div>
          }
        >
          <Show when={props.description}>
            <p style="text-align: center; color: var(--pact-color-text-secondary); margin: 0 0 var(--pact-spacing-4) 0; font-size: var(--pact-font-size-sm);">
              {props.description}
            </p>
          </Show>

          <PactButton class={autoConnectStyles} variant="primary" size="lg" onClick={handleAutoConnect}>
            🚀 Auto Connect
          </PactButton>

          <div class={walletGridStyles}>
            <For each={wallets()}>
              {(metadata) => {
                const isConnected = () => connectedWalletIds().includes(metadata.id);
                return (
                  <PactCard
                    class={`${walletCardStyles} ${isConnected() ? "connected" : ""}`}
                    hoverable
                    clickable
                    padding="md"
                    onClick={() => selectWallet(metadata.id)}
                  >
                    <Show when={isConnected()}>
                      <div class={connectedBadgeStyles}>
                        <PactBadge variant="success" size="sm">
                          Connected
                        </PactBadge>
                      </div>
                    </Show>
                    <div class={walletIconStyles}>
                      <Show when={metadata.icon} fallback={getWalletIcon(metadata)}>
                        <img src={metadata.icon} alt={`${metadata.name} icon`} />
                      </Show>
                    </div>
                    <div>
                      <div class={walletNameStyles}>{metadata.name}</div>
                      <Show when={metadata.description}>
                        <div class={walletDescriptionStyles}>{metadata.description}</div>
                      </Show>
                    </div>
                  </PactCard>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}
