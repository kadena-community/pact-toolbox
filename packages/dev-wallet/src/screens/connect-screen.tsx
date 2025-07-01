import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { css } from 'goober';
import { PactButton, PactCard, PactAlert } from '@pact-toolbox/ui-shared';
import type { Account } from '../types';
import { getDefaultDevWalletManager } from '../manager';
import { walletEventEmitter } from '../stores/wallet-store';

interface ConnectScreenProps {
  accounts: Account[];
  selectedAccount?: Account;
}

const screenStyles = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--pact-spacing-4);
  gap: var(--pact-spacing-4);
`;

const titleStyles = css`
  font-size: var(--pact-font-size-2xl);
  font-weight: var(--pact-font-weight-bold);
  color: var(--pact-color-text-primary);
  text-align: center;
`;

const subtitleStyles = css`
  font-size: var(--pact-font-size-base);
  color: var(--pact-color-text-secondary);
  text-align: center;
  margin-bottom: var(--pact-spacing-4);
`;

const accountListStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-3);
  flex: 1;
  overflow-y: auto;
  padding: 2px; /* Prevent border clipping */
`;


const accountInfoStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const accountDetailsStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-1);
`;

const accountNameStyles = css`
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-text-primary);
`;

const accountAddressStyles = css`
  font-family: var(--pact-font-mono);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-secondary);
`;

const buttonGroupStyles = css`
  display: flex;
  gap: var(--pact-spacing-3);
  justify-content: center;
`;

const checkmarkStyles = css`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--pact-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const ConnectScreen: Component<ConnectScreenProps> = (props) => {
  const [selectedAccount, setSelectedAccount] = createSignal<Account | undefined>(props.selectedAccount);

  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account);
  };

  const handleConnect = () => {
    const account = selectedAccount();
    if (account) {
      walletEventEmitter.emit('account-selected', account);
      walletEventEmitter.emit('connect-approved', account);

      // Auto-close wallet after connect approval
      getDefaultDevWalletManager().hideDevWallet();
    }
  };

  const handleCancel = () => {
    walletEventEmitter.emit('connect-cancelled');

    // Auto-close wallet after connect cancellation
    getDefaultDevWalletManager().hideDevWallet();
  };

  const formatAddress = (address: string): string => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div class={screenStyles}>
      <h2 class={titleStyles}>Connect Wallet</h2>
      <p class={subtitleStyles}>Select an account to connect with this application</p>

      <Show
        when={props.accounts.length > 0}
        fallback={
          <PactAlert variant="warning">
            No accounts available. Please create an account first.
          </PactAlert>
        }
      >
        <div class={accountListStyles}>
          <For each={props.accounts}>
            {(account) => (
              <div
                onClick={() => handleSelectAccount(account)}
              >
                <PactCard
                  variant="compact"
                  padding="sm"
                  hoverable={true}
                  selected={selectedAccount()?.address === account.address}
                >
                  <div class={accountInfoStyles}>
                    <div class={accountDetailsStyles}>
                      <div class={accountNameStyles}>{account.name}</div>
                      <div class={accountAddressStyles}>
                        {formatAddress(account.address)}
                      </div>
                    </div>
                    <Show when={selectedAccount()?.address === account.address}>
                      <div class={checkmarkStyles}>✓</div>
                    </Show>
                  </div>
                </PactCard>
              </div>
            )}
          </For>
        </div>

        <div class={buttonGroupStyles}>
          <PactButton
            variant="ghost"
            onClick={handleCancel}
          >
            Cancel
          </PactButton>
          <PactButton
            variant="primary"
            onClick={handleConnect}
            disabled={!selectedAccount()}
          >
            Connect
          </PactButton>
        </div>
      </Show>
    </div>
  );
};