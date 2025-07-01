// Interactive Demo with Real Wallet Operations using Shared UI
import { render } from "solid-js/web";
import { createSignal, Show, onMount } from "solid-js";
import { css } from "goober";
import { PactButton, PactCard, initializeGlobalStyles } from "@pact-toolbox/ui-shared";
import { DevWalletProvider } from "./provider";
import { execution } from "@pact-toolbox/transaction";

// Initialize global styles
initializeGlobalStyles();

const containerStyles = css`
  max-width: 800px;
  margin: 40px auto;
  padding: var(--pact-spacing-6);
  font-family: var(--pact-font-family);
  background: var(--pact-color-bg-primary);
  border-radius: var(--pact-border-radius-xl);
  box-shadow: var(--pact-shadow-lg);
  color: var(--pact-color-text-primary);
`;

const titleStyles = css`
  font-size: var(--pact-font-size-3xl);
  font-weight: var(--pact-font-weight-bold);
  text-align: center;
  margin-bottom: var(--pact-spacing-6);
  color: var(--pact-color-primary);
`;

const sectionStyles = css`
  margin-bottom: var(--pact-spacing-6);
`;

const buttonGroupStyles = css`
  display: flex;
  gap: var(--pact-spacing-3);
  flex-wrap: wrap;
  margin-bottom: var(--pact-spacing-4);
`;

const statusStyles = css`
  font-weight: var(--pact-font-weight-semibold);
  margin-bottom: var(--pact-spacing-2);
`;

const accountInfoStyles = css`
  font-family: var(--pact-font-mono);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-secondary);
  word-break: break-all;
`;

const transactionHashStyles = css`
  font-family: var(--pact-font-mono);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-secondary);
  word-break: break-all;
`;

const DemoApp = () => {
  const [status, setStatus] = createSignal("DevWallet initialized and ready");
  const [isConnected, setIsConnected] = createSignal(false);
  const [connectedAccount, setConnectedAccount] = createSignal<string>("");
  const [lastTransaction, setLastTransaction] = createSignal<string>("");

  let wallet: any;

  onMount(async () => {
    // Initialize the DevWalletProvider and create wallet
    const walletProvider = new DevWalletProvider({
      networkId: "development",
      rpcUrl: "http://localhost:8080",
      showUI: true,
    });

    wallet = await walletProvider.createWallet();
    console.log("Demo Status:", status());
  });

  const handleConnect = async () => {
    try {
      setStatus("Connecting wallet...");
      const account = await wallet.connect();
      setIsConnected(true);
      setConnectedAccount(account.address);
      setStatus(`Connected to DevWallet! Account: ${account.address}`);
    } catch (error) {
      console.error("Demo Error:", error);
      setStatus(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await wallet.disconnect();
      setIsConnected(false);
      setConnectedAccount("");
      setLastTransaction("");
      setStatus("Disconnected from wallet");
    } catch (error) {
      console.error("Demo Error:", error);
      setStatus(`Disconnect failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleSignSimple = async () => {
    try {
      setStatus("Creating and signing transaction...");

      const result = await execution("(+ 1 2)").sign(wallet).getSignedTransaction();
      setLastTransaction((result as { hash: string }).hash);
      setStatus(`Transaction signed successfully! Hash: ${result.hash}`);
    } catch (error) {
      console.error("Demo Error:", error);
      setStatus(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleSignComplex = async () => {
    try {
      setStatus("Creating and signing complex transaction...");

      const dispstcher = await execution('(coin.get-balance "alice")')
        .withChainId("0")
        .withMeta({
          sender: connectedAccount(),
          gasLimit: 2000,
          gasPrice: 0.000001,
          ttl: 28800,
        })
        .withNetworkId("development")
        .sign(wallet);
      const result = await dispstcher.getSignedTransaction();
      setLastTransaction((result as { hash: string }).hash);
      setStatus(`Complex transaction signed successfully! Hash: ${result.hash}`);
    } catch (error) {
      console.error("Demo Error:", error);
      setStatus(`Complex transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div class={containerStyles}>
      <h1 class={titleStyles}>DevWallet Interactive Demo</h1>

      <div class={sectionStyles}>
        <PactCard variant="compact" padding="md">
          <h3>Connection</h3>
          <p>Test the wallet connection flow with confirmation dialog:</p>
          <div class={buttonGroupStyles}>
            <PactButton variant="primary" onClick={handleConnect} disabled={isConnected()}>
              Connect Wallet
            </PactButton>
            <PactButton variant="ghost" onClick={handleDisconnect} disabled={!isConnected()}>
              Disconnect Wallet
            </PactButton>
          </div>
          <Show when={isConnected()}>
            <p>
              <strong>Connected Account:</strong>
              <br />
              <span class={accountInfoStyles}>{connectedAccount()}</span>
            </p>
          </Show>
        </PactCard>
      </div>

      <div class={sectionStyles}>
        <PactCard variant="compact" padding="md">
          <h3>Transaction Signing</h3>
          <p>Test transaction signing with JSON preview:</p>
          <div class={buttonGroupStyles}>
            <PactButton variant="primary" onClick={handleSignSimple} disabled={!isConnected()}>
              Sign Simple Transaction
            </PactButton>
            <PactButton variant="secondary" onClick={handleSignComplex} disabled={!isConnected()}>
              Sign Complex Transaction
            </PactButton>
          </div>
          <Show when={lastTransaction()}>
            <p>
              <strong>Last Transaction:</strong>
              <br />
              <span class={transactionHashStyles}>{lastTransaction()}</span>
            </p>
          </Show>
        </PactCard>
      </div>

      <div class={sectionStyles}>
        <PactCard variant="compact" padding="md">
          <h3>Status</h3>
          <div class={statusStyles}>{status()}</div>
        </PactCard>
      </div>
    </div>
  );
};

// Initialize and render the demo app
const initDemo = () => {
  const root = document.body;
  render(() => DemoApp(), root);
};

// Start the demo when the DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDemo);
} else {
  initDemo();
}
