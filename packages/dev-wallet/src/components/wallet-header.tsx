import type { Component } from 'solid-js';
import { Show, For } from 'solid-js';
import { css } from 'goober';
import { PactSelect, PactIconButton, type SelectOption } from '@pact-toolbox/ui-shared';
import type { Account, Network } from '../types';
import { walletEventEmitter, walletActions, walletState } from '../stores/wallet-store';

interface WalletHeaderProps {
  selectedAccount?: Account;
  activeNetwork?: Network;
}

const headerStyles = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--pact-color-bg-secondary);
  border-bottom: 1px solid var(--pact-color-border-primary);
  padding: var(--pact-spacing-3) var(--pact-spacing-4);
  height: 60px;
  flex-shrink: 0;
  border-radius: var(--pact-border-radius-xl) var(--pact-border-radius-xl) 0 0;
`;

const accountInfoStyles = css`
  display: flex;
  align-items: center;
  gap: var(--pact-spacing-3);
  flex: 1;
  min-width: 0;
`;

const accountDetailsStyles = css`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const accountNameStyles = css`
  font-weight: var(--pact-font-weight-semibold);
  font-size: var(--pact-font-size-base);
  color: var(--pact-color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const accountAddressStyles = css`
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-secondary);
  font-family: var(--pact-font-mono);
`;

const networkSelectStyles = css`
  min-width: 120px;
`;

const noAccountStyles = css`
  color: var(--pact-color-text-tertiary);
  font-style: italic;
`;

export const WalletHeader: Component<WalletHeaderProps> = (props) => {
  const formatAddress = (address: string): string => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleNetworkChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const network = walletState.networks.find(n => n.id === target.value);
    if (network) {
      walletActions.changeNetwork(network);
    }
  };

  const handleCloseClick = () => {
    walletEventEmitter.emit('close-wallet');
  };

  const networkOptions = (): SelectOption[] => {
    return walletState.networks.map(network => ({
      value: network.id,
      label: network.name
    }));
  };

  return (
    <div class={headerStyles}>
      <div class={accountInfoStyles}>
        <Show
          when={props.selectedAccount}
          fallback={<span class={noAccountStyles}>No account selected</span>}
        >
          {(account) => (
            <div class={accountDetailsStyles}>
              <div class={accountNameStyles}>{account().name}</div>
              <div class={accountAddressStyles}>
                {formatAddress(account().address)}
              </div>
            </div>
          )}
        </Show>
      </div>

      <div class={networkSelectStyles}>
        <PactSelect
          size="sm"
          value={props.activeNetwork?.id || ''}
          onChange={handleNetworkChange}
          options={networkOptions()}
          variant="filled"
        />
      </div>

      <PactIconButton
        variant="ghost"
        size="sm"
        onClick={handleCloseClick}
        aria-label="Close wallet"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 4L4 12M4 4l8 8" />
        </svg>
      </PactIconButton>
    </div>
  );
};