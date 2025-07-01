import type { Component } from 'solid-js';
import { Show, createSignal } from 'solid-js';
import { css } from 'goober';
import { PactButton, PactCard, PactAlert, PactJsonTree } from '@pact-toolbox/ui-shared';
import type { Account, Network, PendingTransaction } from '../types';
import { getDefaultDevWalletManager } from '../manager';
import { walletEventEmitter } from '../stores/wallet-store';

interface SignScreenProps {
  transaction?: PendingTransaction;
  selectedAccount?: Account;
  network?: Network;
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
`;

const transactionDetailsStyles = css`
  flex: 1;
  overflow-y: auto;
  padding: 2px; /* Prevent border clipping */
`;

const sectionStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-2);
`;

const labelStyles = css`
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-text-primary);
  margin-bottom: var(--pact-spacing-1);
`;

const valueStyles = css`
  font-family: var(--pact-font-mono);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-secondary);
  word-break: break-all;
`;

const codeBlockStyles = css`
  background: var(--pact-color-bg-tertiary);
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-md);
  padding: var(--pact-spacing-3);
  font-family: var(--pact-font-mono);
  font-size: var(--pact-font-size-sm);
  overflow-x: auto;
  white-space: pre-wrap;
`;

const buttonGroupStyles = css`
  display: flex;
  gap: var(--pact-spacing-3);
  justify-content: center;
`;

const warningStyles = css`
  background: var(--pact-color-warning-lighter);
  border: 1px solid var(--pact-color-warning);
  border-radius: var(--pact-border-radius-md);
  padding: var(--pact-spacing-3);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-warning-darker);
`;

export const SignScreen: Component<SignScreenProps> = (props) => {
  const [isSigning, setIsSigning] = createSignal(false);

  const handleApprove = async () => {
    setIsSigning(true);
    try {
      // In a real implementation, sign the transaction here
      await new Promise(resolve => setTimeout(resolve, 1000));

      walletEventEmitter.emit('sign-approved', props.transaction);

      // Auto-close wallet after sign approval
      getDefaultDevWalletManager().hideDevWallet();
    } catch (error) {
      console.error('Failed to sign transaction:', error);
    } finally {
      setIsSigning(false);
    }
  };

  const handleReject = () => {
    walletEventEmitter.emit('sign-rejected');

    // Auto-close wallet after sign rejection
    getDefaultDevWalletManager().hideDevWallet();
  };

  const parseTransaction = () => {
    if (!props.transaction?.request?.cmd) return null;
    try {
      return JSON.parse(props.transaction.request.cmd);
    } catch {
      return null;
    }
  };

  const parsedTx = parseTransaction();

  return (
    <div class={screenStyles}>
      <h2 class={titleStyles}>Sign Transaction</h2>
      <p class={subtitleStyles}>Review and sign this transaction</p>

      <Show
        when={props.transaction}
        fallback={
          <PactAlert variant="error">
            No transaction to sign
          </PactAlert>
        }
      >
        <div class={transactionDetailsStyles}>
          <div class={sectionStyles}>
            <Show when={props.selectedAccount}>
              <PactCard
                variant="compact"
                padding="sm"
              >
                <div class={labelStyles}>Signing Account</div>
                <div class={valueStyles}>
                  {props.selectedAccount?.name} ({props.selectedAccount?.address})
                </div>
              </PactCard>
            </Show>

            <Show when={props.network}>
              <PactCard
                variant="compact"
                padding="sm"
              >
                <div class={labelStyles}>Network</div>
                <div class={valueStyles}>
                  {props.network?.name} (Chain {props.network?.chainId})
                </div>
              </PactCard>
            </Show>

            <Show when={parsedTx?.payload}>
              <PactCard
                variant="compact"
                padding="sm"
              >
                <div class={labelStyles}>Transaction Details</div>

                <Show when={parsedTx.payload.exec}>
                  <div class={sectionStyles}>
                    <div class={labelStyles}>Code</div>
                    <div class={codeBlockStyles}>
                      {parsedTx.payload.exec.code}
                    </div>
                  </div>
                </Show>

                <Show when={parsedTx.signers && parsedTx.signers.length > 0}>
                  <div class={sectionStyles}>
                    <div class={labelStyles}>Capabilities</div>
                    <PactJsonTree data={parsedTx.signers[0].clist || []} />
                  </div>
                </Show>

                <Show when={parsedTx.meta}>
                  <div class={sectionStyles}>
                    <div class={labelStyles}>Metadata</div>
                    <PactJsonTree data={parsedTx.meta} />
                  </div>
                </Show>
              </PactCard>
            </Show>

            <div class={warningStyles}>
              ⚠️ Only sign transactions from applications you trust. This action cannot be undone.
            </div>
          </div>
        </div>

        <div class={buttonGroupStyles}>
          <PactButton
            variant="ghost"
            onClick={handleReject}
            disabled={isSigning()}
          >
            Reject
          </PactButton>
          <PactButton
            variant="primary"
            onClick={handleApprove}
            loading={isSigning()}
          >
            Sign Transaction
          </PactButton>
        </div>
      </Show>
    </div>
  );
};