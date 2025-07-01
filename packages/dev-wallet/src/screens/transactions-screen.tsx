import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { css } from 'goober';
import { PactCard, PactBadge, PactEmptyState } from '@pact-toolbox/ui-shared';
import type { Transaction, Account } from '../types';

interface TransactionsScreenProps {
  transactions: Transaction[];
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
  margin-bottom: var(--pact-spacing-2);
`;

const titleStyles = css`
  font-size: var(--pact-font-size-base);
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-text-primary);
`;

const transactionListStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-2);
  flex: 1;
  min-height: 0;
`;

const transactionCardStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-2);
`;

const transactionHeaderStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const transactionInfoStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-1);
`;

const capabilityStyles = css`
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-text-primary);
`;

const addressStyles = css`
  font-family: var(--pact-font-mono);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-secondary);
`;

const hashStyles = css`
  font-family: var(--pact-font-mono);
  font-size: var(--pact-font-size-xs);
  color: var(--pact-color-text-tertiary);
  word-break: break-all;
`;

const timestampStyles = css`
  font-size: var(--pact-font-size-xs);
  color: var(--pact-color-text-tertiary);
`;

const amountStyles = css`
  font-weight: var(--pact-font-weight-semibold);
  font-size: var(--pact-font-size-lg);
`;

export const TransactionsScreen: Component<TransactionsScreenProps> = (props) => {
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatAddress = (address?: string): string => {
    if (!address) return 'Unknown';
    if (address.length <= 16) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const filteredTransactions = () => {
    if (!props.selectedAccount) return props.transactions;
    return props.transactions.filter(
      tx => tx.from === props.selectedAccount?.address || tx.to === props.selectedAccount?.address
    );
  };

  return (
    <div class={screenStyles}>
      <div class={headerStyles}>
        <h2 class={titleStyles}>Activity</h2>
      </div>

      <Show
        when={filteredTransactions().length > 0}
        fallback={
          <PactEmptyState
            title="No transactions yet"
            description="Your transaction history will appear here"
          />
        }
      >
        <div class={transactionListStyles}>
          <For each={filteredTransactions()}>
            {(transaction) => (
              <PactCard>
                <div class={transactionCardStyles}>
                  <div class={transactionHeaderStyles}>
                    <div class={transactionInfoStyles}>
                      <div class={capabilityStyles}>
                        {transaction.capability || 'Transfer'}
                      </div>
                      <div class={addressStyles}>
                        {formatAddress(transaction.from)} → {formatAddress(transaction.to)}
                      </div>
                    </div>
                    <PactBadge variant={getStatusVariant(transaction.status)}>
                      {transaction.status}
                    </PactBadge>
                  </div>

                  <Show when={transaction.amount}>
                    <div class={amountStyles}>
                      {transaction.amount} KDA
                    </div>
                  </Show>

                  <Show when={transaction.hash}>
                    <div class={hashStyles}>
                      {transaction.hash}
                    </div>
                  </Show>

                  <div class={timestampStyles}>
                    {formatTimestamp(transaction.timestamp)}
                  </div>
                </div>
              </PactCard>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};