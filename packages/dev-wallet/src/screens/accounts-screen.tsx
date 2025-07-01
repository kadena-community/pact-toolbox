import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { css, keyframes } from 'goober';
import { PactButton, PactCard, PactModal, PactInput, PactEmptyState, PactIconButton, PactBadge, PactDropdown, PactDropdownItem, PactDropdownDivider, useToast } from '@pact-toolbox/ui-shared';
import type { Account } from '../types';
import { genKeyPair } from '@pact-toolbox/crypto';
import { walletActions, walletEventEmitter, walletState } from '../stores/wallet-store';
import { KeyPairSigner } from '@pact-toolbox/signers';
import { exportBase16Key } from '@pact-toolbox/crypto';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

interface AccountsScreenProps {
  accounts: Account[];
  selectedAccount?: Account;
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
  flex-shrink: 0;
`;

const titleStyles = css`
  font-size: var(--pact-font-size-base);
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-text-primary);
`;

const actionBarStyles = css`
  display: flex;
  gap: var(--pact-spacing-2);
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
`;

const accountsListStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-2);
  flex: 1;
  min-height: 0;
`;

const accountCardStyles = css`
  cursor: pointer;
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  position: relative;

  &:hover {
    transform: translateY(-2px);
  }
`;

const accountInfoStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-2);
`;

const accountNameStyles = css`
  font-weight: var(--pact-font-weight-semibold);
  font-size: var(--pact-font-size-lg);
  color: var(--pact-color-text-primary);
`;

const accountAddressStyles = css`
  font-family: var(--pact-font-mono);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const accountBalanceStyles = css`
  display: flex;
  align-items: center;
  gap: var(--pact-spacing-2);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-primary);
  font-weight: var(--pact-font-weight-medium);
`;

const accountDetailsStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const refreshButtonStyles = css`
  margin-left: var(--pact-spacing-2);
`;

const actionButtonsStyles = css`
  display: flex;
  gap: var(--pact-spacing-2);
  width: 100%;
  justify-content: flex-end;
`;

const formStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-4);
`;

const modalButtonGroupStyles = css`
  display: flex;
  gap: var(--pact-spacing-3);
`;

export const AccountsScreen: Component<AccountsScreenProps> = (props) => {
  const toast = useToast();
  const [showCreateDialog, setShowCreateDialog] = createSignal(false);
  const [showImportDialog, setShowImportDialog] = createSignal(false);
  const [showDiscoverDialog, setShowDiscoverDialog] = createSignal(false);
  const [accountName, setAccountName] = createSignal('');
  const [privateKey, setPrivateKey] = createSignal('');
  const [publicKeyForDiscovery, setPublicKeyForDiscovery] = createSignal('');
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [isDiscovering, setIsDiscovering] = createSignal(false);
  const [isCreatingOnChain, setIsCreatingOnChain] = createSignal<string | null>(null);
  const [importError, setImportError] = createSignal('');
  const [discoveryResult, setDiscoveryResult] = createSignal<string>('');

  const handleSelectAccount = async (account: Account) => {
    // Create a deep copy to avoid reference issues
    const accountCopy = { ...account };
    await walletActions.selectAccount(accountCopy);
  };

  const handleGenerateAccount = async () => {
    setIsGenerating(true);
    try {
      const keypair = await genKeyPair();
      const name = accountName() || `Account ${props.accounts.length + 1}`;

      const newAccount: Account = {
        address: `k:${keypair.publicKey}`,
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        name,
        chainId: '0',
        balance: '0',
        networkId: walletState.activeNetwork?.id,
        existsOnChain: false,
      };

      await walletActions.addAccount(newAccount);

      setShowCreateDialog(false);
      setAccountName('');
    } catch (error) {
      console.error('Failed to generate account:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteAccount = async (account: Account) => {
    if (confirm(`Delete account "${account.name}"?`)) {
      await walletActions.deleteAccount(account.address);
      toast.showToast({
        variant: "success",
        title: "Account deleted",
        message: `Account "${account.name}" has been deleted`,
        duration: 3000
      });
    }
  };

  const handleRefreshBalance = async (account: Account) => {
    setIsRefreshing(true);
    try {
      // Create a copy to avoid reference issues
      const accountCopy = { ...account };
      await walletActions.refreshAccountBalance(accountCopy);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshAllBalances = async () => {
    setIsRefreshing(true);
    try {
      await walletActions.refreshAllBalances();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateOnChain = async (account: Account) => {
    setIsCreatingOnChain(account.address);
    try {
      // Create a copy to avoid reference issues
      const accountCopy = { ...account };
      await walletActions.createAccountOnChain(accountCopy);
      await walletActions.refreshAccountBalance(accountCopy);
    } catch (error) {
      console.error('Failed to create account on chain:', error);
      toast.showToast({
        variant: "error",
        title: "Failed to create account",
        message: String(error).replace('Error: ', ''),
        duration: 0
      });
    } finally {
      setIsCreatingOnChain(null);
    }
  };

  const handleDiscoverAccounts = async () => {
    const pk = publicKeyForDiscovery().trim();
    if (!pk) {
      setDiscoveryResult('Please enter a public key');
      return;
    }

    setIsDiscovering(true);
    setDiscoveryResult('');
    try {
      const discovered = await walletActions.discoverAccounts(pk);
      if (discovered.length > 0) {
        setDiscoveryResult(`Found ${discovered.length} account(s) across chains`);
        setShowDiscoverDialog(false);
        setPublicKeyForDiscovery('');
      } else {
        setDiscoveryResult('No accounts found for this public key');
      }
    } catch (error) {
      console.error('Discovery error:', error);
      setDiscoveryResult('Failed to discover accounts');
    } finally {
      setIsDiscovering(false);
    }
  };

  const formatBalance = (balance?: number | string) => {
    if (balance === undefined || balance === null) return '0 KDA';
    const numBalance = typeof balance === 'string' ? parseFloat(balance) : balance;
    return `${numBalance.toFixed(4)} KDA`;
  };

  const handleImportAccount = async () => {
    const pk = privateKey().trim();
    if (!pk) {
      setImportError('Private key is required');
      return;
    }

    try {
      // Derive public key from private key
      const signer = await KeyPairSigner.fromPrivateKeyHex(pk);
      const publicKey = signer.address;
      const name = accountName() || `Imported Account ${props.accounts.length + 1}`;

      const newAccount: Account = {
        address: `k:${publicKey}`,
        publicKey,
        privateKey: pk,
        name,
        chainId: '0',
        balance: '0',
        networkId: walletState.activeNetwork?.id,
        existsOnChain: false,
      };

      await walletActions.addAccount(newAccount);

      // Check if account exists on chain
      await walletActions.refreshAccountBalance(newAccount);

      setShowImportDialog(false);
      setAccountName('');
      setPrivateKey('');
      setImportError('');
    } catch (error) {
      console.error('Import error:', error);
      setImportError('Invalid private key');
    }
  };


  return (
    <div class={screenStyles}>
      <div class={headerStyles}>
        <h2 class={titleStyles}>Accounts</h2>
        <div class={actionBarStyles}>
          <PactButton
            size="sm"
            variant="primary"
            onClick={() => setShowCreateDialog(true)}
            startIcon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 4v8m-4-4h8" />
              </svg>
            }
          >
            Create Account
          </PactButton>
          <PactDropdown
            target={
              <PactButton
                size="sm"
                variant="ghost"
                title="More actions"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="8" cy="8" r="1" />
                  <circle cx="8" cy="3" r="1" />
                  <circle cx="8" cy="13" r="1" />
                </svg>
              </PactButton>
            }
            placement="bottom-end"
          >
            <PactDropdownItem onClick={() => setShowImportDialog(true)}>
              <span style={{ display: 'flex', 'align-items': 'center', gap: 'var(--pact-spacing-2)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8 2v10m0 0l4-4m-4 4L4 8M2 14h12" />
                </svg>
                Import Account
              </span>
            </PactDropdownItem>
            <PactDropdownItem onClick={() => setShowDiscoverDialog(true)}>
              <span style={{ display: 'flex', 'align-items': 'center', gap: 'var(--pact-spacing-2)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="7" cy="7" r="4" />
                  <path d="M14 14l-3-3" />
                </svg>
                Discover Accounts
              </span>
            </PactDropdownItem>
            <PactDropdownDivider />
            <PactDropdownItem
              onClick={handleRefreshAllBalances}
              disabled={isRefreshing()}
            >
              <span style={{ display: 'flex', 'align-items': 'center', gap: 'var(--pact-spacing-2)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style={{ animation: isRefreshing() ? `${spin} 1s linear infinite` : undefined }}>
                  <path d="M2 8a6 6 0 1 0 6-6v2m0-2L5 5" />
                </svg>
                Refresh All Balances
              </span>
            </PactDropdownItem>
          </PactDropdown>
        </div>
      </div>

      <Show
        when={props.accounts.length > 0}
        fallback={
          <PactEmptyState
            title="No accounts yet"
            description="Create or import an account to get started"
          />
        }
      >
        <div class={accountsListStyles}>
          <For each={props.accounts}>
            {(account) => (
              <div
                class={accountCardStyles}
                onClick={() => handleSelectAccount(account)}
              >
                <PactCard
                  variant="compact"
                  padding="sm"
                  hoverable={true}
                  selected={props.selectedAccount?.address === account.address}
                  footer={
                    <div class={actionButtonsStyles}>
                      <Show when={!account.existsOnChain}>
                        <PactIconButton
                          size="sm"
                          variant="primary"
                          onClick={(e: MouseEvent) => {
                            e.stopPropagation();
                            handleCreateOnChain(account);
                          }}
                          aria-label="Create account on chain"
                          title="Create on chain"
                        >
                          <Show
                            when={isCreatingOnChain() === account.address}
                            fallback={
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M8 4v8m-4-4h8" />
                              </svg>
                            }
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style={{ animation: `${spin} 1s linear infinite` }}>
                              <path d="M8 2v4m0 4v4m4-6h-4m-2 0H2" opacity="0.5" />
                            </svg>
                          </Show>
                        </PactIconButton>
                      </Show>
                      <PactIconButton
                        size="sm"
                        variant="ghost"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          handleRefreshBalance(account);
                        }}
                        aria-label="Refresh balance"
                        title="Refresh balance"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M2 8a6 6 0 1 0 6-6v2m0-2L5 5" />
                        </svg>
                      </PactIconButton>
                      <PactIconButton
                        size="sm"
                        variant="danger"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          handleDeleteAccount(account);
                        }}
                        aria-label="Delete account"
                        title="Delete account"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 3l10 10M13 3L3 13" />
                        </svg>
                      </PactIconButton>
                    </div>
                  }
                >
                  <div class={accountInfoStyles}>
                    <div style={{ display: 'flex', 'flex-direction': 'column', gap: 'var(--pact-spacing-1)' }}>
                      <div style={{ display: 'flex', 'align-items': 'center', gap: 'var(--pact-spacing-2)' }}>
                        <div class={accountNameStyles}>
                          {account.name}
                        </div>
                        <Show when={!account.existsOnChain}>
                          <PactBadge variant="warning" size="sm">
                            Not on chain
                          </PactBadge>
                        </Show>
                      </div>
                      <div class={accountAddressStyles}>{account.address}</div>
                      <div class={accountBalanceStyles}>
                        {formatBalance(account.balance)}
                      </div>
                    </div>
                  </div>
                </PactCard>
              </div>
            )}
          </For>
        </div>
      </Show>

      <PactModal
        open={showCreateDialog()}
        onClose={() => setShowCreateDialog(false)}
        title="Create New Account"
        footer={
          <div class={modalButtonGroupStyles}>
            <PactButton
              variant="ghost"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </PactButton>
            <PactButton
              variant="primary"
              onClick={handleGenerateAccount}
              loading={isGenerating()}
            >
              Generate
            </PactButton>
          </div>
        }
      >
        <div class={formStyles}>
          <PactInput
            label="Account Name (optional)"
            value={accountName()}
            onInput={(e) => setAccountName(e.currentTarget.value)}
            placeholder="e.g., My Main Account"
          />
        </div>
      </PactModal>

      <PactModal
        open={showImportDialog()}
        onClose={() => setShowImportDialog(false)}
        title="Import Account"
        footer={
          <div class={modalButtonGroupStyles}>
            <PactButton
              variant="ghost"
              onClick={() => setShowImportDialog(false)}
            >
              Cancel
            </PactButton>
            <PactButton
              variant="primary"
              onClick={handleImportAccount}
            >
              Import
            </PactButton>
          </div>
        }
      >
        <div class={formStyles}>
          <PactInput
            label="Account Name (optional)"
            value={accountName()}
            onInput={(e) => setAccountName(e.currentTarget.value)}
            placeholder="e.g., My Imported Account"
          />
          <PactInput
            label="Private Key"
            type="password"
            value={privateKey()}
            onInput={(e) => setPrivateKey(e.currentTarget.value)}
            placeholder="Enter your private key"
            error={importError()}
          />
        </div>
      </PactModal>

      <PactModal
        open={showDiscoverDialog()}
        onClose={() => setShowDiscoverDialog(false)}
        title="Discover Accounts"
        footer={
          <div class={modalButtonGroupStyles}>
            <PactButton
              variant="ghost"
              onClick={() => setShowDiscoverDialog(false)}
            >
              Cancel
            </PactButton>
            <PactButton
              variant="primary"
              onClick={handleDiscoverAccounts}
              loading={isDiscovering()}
            >
              Discover
            </PactButton>
          </div>
        }
      >
        <div class={formStyles}>
          <PactInput
            label="Public Key"
            value={publicKeyForDiscovery()}
            onInput={(e) => setPublicKeyForDiscovery(e.currentTarget.value)}
            placeholder="Enter the public key to search for accounts"
          />
          <Show when={discoveryResult()}>
            <div style={{ color: 'var(--pact-color-text-secondary)', 'font-size': 'var(--pact-font-size-sm)' }}>
              {discoveryResult()}
            </div>
          </Show>
        </div>
      </PactModal>
    </div>
  );
};