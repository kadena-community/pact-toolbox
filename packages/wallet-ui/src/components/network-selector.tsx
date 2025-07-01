import { For, Show, JSX } from "solid-js";
import { css } from "goober";
import { PactCard, PactBadge, PactButton } from "@pact-toolbox/ui-shared";
import type { WalletNetwork } from "@pact-toolbox/wallet-core";
import { NetworkConfigProvider } from "@pact-toolbox/network-config";

const networkGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--pact-spacing-4);
  margin-top: var(--pact-spacing-4);
`;

const networkCardStyles = css`
  position: relative;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--pact-spacing-3);
  cursor: pointer;
  text-align: center;
  transition: all var(--pact-transition-base) var(--pact-transition-timing);

  &.active {
    border-color: var(--pact-color-primary-light);
    background: var(--pact-color-primary-lighter);

    &:hover {
      border-color: var(--pact-color-primary);
    }
  }
`;

const networkIconStyles = css`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  border-radius: var(--pact-border-radius-lg);
  background: var(--pact-color-bg-accent);
  box-shadow: var(--pact-shadow-sm);
`;

const networkNameStyles = css`
  font-size: var(--pact-font-size-base);
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-text-primary);
  line-height: 1.2;
`;

const networkDescriptionStyles = css`
  font-size: var(--pact-font-size-xs);
  color: var(--pact-color-text-secondary);
  margin-top: var(--pact-spacing-1);
`;

const activeBadgeStyles = css`
  position: absolute;
  top: var(--pact-spacing-2);
  right: var(--pact-spacing-2);
`;

const autoConnectStyles = css`
  width: 100%;
  margin-bottom: var(--pact-spacing-4);
`;

const noNetworksStyles = css`
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

const errorMessageStyles = css`
  margin-top: var(--pact-spacing-xs);
  padding: var(--pact-spacing-xs) var(--pact-spacing-sm);
  background: var(--pact-color-error-light);
  border: var(--pact-border-width) solid var(--pact-color-error);
  border-radius: var(--pact-border-radius-sm);
  color: var(--pact-color-error);
  font-size: var(--pact-font-size-xs);
`;

interface NetworkSelectorProps {
  currentNetwork: WalletNetwork | null;
  supportedNetworks: string[];
  canSwitch?: boolean;
  loading?: boolean;
  error?: string;
  onNetworkSwitch?: (networkId: string) => void;
  description?: string;
}

const getNetworkIcon = (networkId: string): JSX.Element => {
  const icons: Record<string, JSX.Element> = {
    mainnet: <span style="font-size: 32px">🌐</span>,
    testnet: <span style="font-size: 32px">🧪</span>,
    devnet: <span style="font-size: 32px">🛠️</span>,
    development: <span style="font-size: 32px">💻</span>,
    kadenalocal: <span style="font-size: 32px">🏠</span>,
  };
  return icons[networkId.toLowerCase()] || <span style="font-size: 32px">🔗</span>;
};

const getNetworkDescription = (networkId: string): string => {
  const descriptions: Record<string, string> = {
    mainnet: "Production network",
    testnet: "Test network for development",
    devnet: "Development network",
    development: "Local development environment",
    kadenalocal: "Local Kadena instance",
  };
  return descriptions[networkId.toLowerCase()] || "Custom network";
};

export function NetworkSelector(props: NetworkSelectorProps): JSX.Element {
  const handleNetworkSelect = (networkId: string) => {
    if (networkId !== props.currentNetwork?.networkId) {
      props.onNetworkSwitch?.(networkId);
    }
  };

  const handleAutoConnect = () => {
    // Auto-select the first available network
    const networks = availableNetworks();
    if (networks.length > 0 && networks[0]) {
      handleNetworkSelect(networks[0].networkId);
    }
  };

  const availableNetworks = () =>
    props.supportedNetworks
      .map((id) => NetworkConfigProvider.getInstance().getNetworkById(id))
      .filter(Boolean);

  return (
    <div>
      <Show when={props.description}>
        <p style="text-align: center; color: var(--pact-color-text-secondary); margin: 0 0 var(--pact-spacing-4) 0; font-size: var(--pact-font-size-sm);">
          {props.description}
        </p>
      </Show>

      <Show
        when={availableNetworks().length > 0}
        fallback={
          <div class={noNetworksStyles}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 21a9 9 0 110-18 9 9 0 010 18zm0 0c1.657 0 3-4.03 3-9s-1.343-9-3-9-3 4.03-3 9 1.343 9 3 9z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.055 11h17.89M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3 7.5 7.03 7.5 12s2.015 9 4.5 9z" />
            </svg>
            <h3>No networks available</h3>
            <p>No networks are configured for this application.</p>
          </div>
        }
      >
        <Show when={props.canSwitch && availableNetworks().length > 1}>
          <PactButton class={autoConnectStyles} variant="primary" size="lg" onClick={handleAutoConnect}>
            🚀 Auto Connect
          </PactButton>
        </Show>

        <div class={networkGridStyles}>
          <For each={availableNetworks()}>
            {(network) => {
              const isActive = () => network?.networkId === props.currentNetwork?.networkId;
              return (
                <PactCard
                  class={`${networkCardStyles} ${isActive() ? "active" : ""}`}
                  hoverable={props.canSwitch}
                  clickable={props.canSwitch}
                  padding="md"
                  onClick={() => props.canSwitch && handleNetworkSelect(network?.networkId || "")}
                >
                  <Show when={isActive()}>
                    <div class={activeBadgeStyles}>
                      <PactBadge variant="primary" size="sm">Active</PactBadge>
                    </div>
                  </Show>
                  <div class={networkIconStyles}>
                    {getNetworkIcon(network?.networkId || "")}
                  </div>
                  <div>
                    <div class={networkNameStyles}>{network?.name || "Unknown"}</div>
                    <div class={networkDescriptionStyles}>
                      {getNetworkDescription(network?.networkId || "")}
                    </div>
                  </div>
                </PactCard>
              );
            }}
          </For>
        </div>
      </Show>

      <Show when={props.error}>
        <div class={errorMessageStyles}>{props.error}</div>
      </Show>
    </div>
  );
}
