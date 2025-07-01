import type { Component } from 'solid-js';
import { For, Show, createSignal } from 'solid-js';
import { css } from 'goober';
import { PactCard, PactBadge, PactButton, PactModal, PactInput, PactIconButton, useToast } from '@pact-toolbox/ui-shared';
import type { Network } from '../types';
import { walletActions, walletEventEmitter, getWalletStorage } from '../stores/wallet-store';

interface NetworksScreenProps {
  networks: Network[];
  activeNetwork?: Network;
}

const screenStyles = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--pact-spacing-4);
  gap: var(--pact-spacing-3);
`;

const headerStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--pact-spacing-2);
`;

const titleStyles = css`
  font-size: var(--pact-font-size-lg);
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-text-primary);
`;

const buttonGroupStyles = css`
  display: flex;
  gap: var(--pact-spacing-2);
`;

const deleteButtonStyles = css`
  margin-left: auto;
`;

const networkListStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-2);
  flex: 1;
  min-height: 0;
`;

const networkCardStyles = css`
  cursor: pointer;
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  position: relative;

  &:hover {
    transform: translateY(-2px);
  }
`;

const networkDetailsStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-2);
  flex: 1;
  min-width: 0;
`;

const networkNameStyles = css`
  font-weight: var(--pact-font-weight-semibold);
  font-size: var(--pact-font-size-lg);
  color: var(--pact-color-text-primary);
`;

const networkUrlStyles = css`
  font-family: var(--pact-font-mono);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const chainInfoStyles = css`
  display: flex;
  align-items: center;
  gap: var(--pact-spacing-2);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-tertiary);
`;

export const NetworksScreen: Component<NetworksScreenProps> = (props) => {
  const toast = useToast();
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [networkName, setNetworkName] = createSignal('');
  const [networkId, setNetworkId] = createSignal('');
  const [rpcUrl, setRpcUrl] = createSignal('');
  const [chainId, setChainId] = createSignal('0');
  const [explorerUrl, setExplorerUrl] = createSignal('');
  const [addError, setAddError] = createSignal('');

  const handleSelectNetwork = async (network: Network) => {
    await walletActions.changeNetwork(network);
  };

  const handleDeleteNetwork = async (network: Network, e: MouseEvent) => {
    e.stopPropagation();
    if (network.isCustom && confirm(`Delete custom network "${network.name}"?`)) {
      await getWalletStorage().deleteCustomNetwork(network.id);
      toast.showToast({
        variant: "success",
        title: "Network deleted",
        message: `Custom network "${network.name}" has been deleted`,
        duration: 3000
      });
      // Reload networks
      window.location.reload();
    }
  };

  const handleAddNetwork = async () => {
    setAddError('');

    if (!networkName() || !networkId() || !rpcUrl()) {
      setAddError('Please fill in all required fields');
      return;
    }

    const newNetwork: Network = {
      id: networkId(),
      name: networkName(),
      rpcUrl: rpcUrl(),
      chainId: chainId() || '0',
      explorerUrl: explorerUrl() || undefined,
      isActive: false,
      isCustom: true,
    };

    try {
      await getWalletStorage().saveCustomNetwork(newNetwork);
      setShowAddModal(false);
      // Reset form
      setNetworkName('');
      setNetworkId('');
      setRpcUrl('');
      setChainId('0');
      setExplorerUrl('');
      // Reload to show new network
      window.location.reload();
    } catch (error) {
      setAddError('Failed to add network');
    }
  };

  return (
    <div class={screenStyles}>
      <div class={headerStyles}>
        <h2 class={titleStyles}>Networks</h2>
        <PactButton
          size="sm"
          variant="secondary"
          onClick={() => setShowAddModal(true)}
        >
          Add Network
        </PactButton>
      </div>

      <div class={networkListStyles}>
        <For each={props.networks}>
          {(network) => (
            <div
              class={networkCardStyles}
              onClick={() => handleSelectNetwork(network)}
            >
              <PactCard
                variant="compact"
                padding="sm"
                hoverable={true}
                selected={props.activeNetwork?.id === network.id}
                footer={
                  network.isCustom ? (
                    <div style={{ display: 'flex', gap: 'var(--pact-spacing-2)', 'justify-content': 'flex-end', width: '100%' }}>
                      <PactIconButton
                        variant="ghost"
                        size="sm"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          // TODO: Implement edit functionality
                          console.log('Edit network:', network.id);
                        }}
                        aria-label="Edit network"
                        title="Edit network"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 2l3 3M2 13l3-3 7-7-3-3-7 7-3 3v3h3z" />
                        </svg>
                      </PactIconButton>
                      <PactIconButton
                        variant="danger"
                        size="sm"
                        onClick={(e: MouseEvent) => handleDeleteNetwork(network, e)}
                        aria-label="Delete network"
                        title="Delete network"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 3l10 10M13 3L3 13" />
                        </svg>
                      </PactIconButton>
                    </div>
                  ) : undefined
                }
              >
                <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'flex-start' }}>
                  <div class={networkDetailsStyles}>
                    <div class={networkNameStyles}>
                      {network.name}
                      <Show when={network.isCustom}>
                        {' '}
                        <PactBadge variant="info" size="sm">Custom</PactBadge>
                      </Show>
                    </div>
                    <div class={networkUrlStyles}>{network.rpcUrl}</div>
                    <div class={chainInfoStyles}>
                      Chain ID: {network.chainId}
                    </div>
                  </div>
                  <Show when={network.isActive}>
                    <PactBadge variant="success">Active</PactBadge>
                  </Show>
                </div>
              </PactCard>
            </div>
          )}
        </For>
      </div>

      <PactModal
        open={showAddModal()}
        onClose={() => setShowAddModal(false)}
        title="Add Custom Network"
        footer={
          <div class={buttonGroupStyles}>
            <PactButton
              variant="ghost"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </PactButton>
            <PactButton
              variant="primary"
              onClick={handleAddNetwork}
            >
              Add Network
            </PactButton>
          </div>
        }
      >
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: 'var(--pact-spacing-3)' }}>
          <PactInput
            label="Network Name*"
            placeholder="e.g., Custom Testnet"
            value={networkName()}
            onInput={(e) => setNetworkName(e.currentTarget.value)}
          />
          <PactInput
            label="Network ID*"
            placeholder="e.g., custom-testnet"
            value={networkId()}
            onInput={(e) => setNetworkId(e.currentTarget.value)}
          />
          <PactInput
            label="RPC URL*"
            placeholder="https://api.example.com/chainweb/0.0/..."
            value={rpcUrl()}
            onInput={(e) => setRpcUrl(e.currentTarget.value)}
          />
          <PactInput
            label="Chain ID"
            placeholder="0"
            value={chainId()}
            onInput={(e) => setChainId(e.currentTarget.value)}
          />
          <PactInput
            label="Explorer URL (optional)"
            placeholder="https://explorer.example.com"
            value={explorerUrl()}
            onInput={(e) => setExplorerUrl(e.currentTarget.value)}
          />
          <Show when={addError()}>
            <div style={{ color: 'var(--pact-color-error)', 'font-size': 'var(--pact-font-size-sm)' }}>
              {addError()}
            </div>
          </Show>
        </div>
      </PactModal>
    </div>
  );
};