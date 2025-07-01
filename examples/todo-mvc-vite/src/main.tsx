import { WalletManager } from "@pact-toolbox/wallet-manager";
import { ChainweaverWalletProvider } from "@pact-toolbox/wallet-chainweaver";
import { EckoWalletProvider } from "@pact-toolbox/wallet-ecko";
import { DevWalletProvider } from "@pact-toolbox/dev-wallet";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { queryClient } from "./api/queryClient";
import App from "./App.tsx";
import { WalletProvider } from "@pact-toolbox/wallet-react";

// Add error boundary to catch any rendering errors
try {
  const root = ReactDOM.createRoot(document.getElementById("root")!);

  // Create wallet manager with config
  const walletManager = new WalletManager({
    enableWalletUI: true,
    autoConnect: true,
    rememberLast: true,
  });

  // In development, DevWallet and Keypair are auto-configured
  // In production, you must explicitly register all wallets including Keypair
  walletManager
    .register("ecko", new EckoWalletProvider())
    .register("chainweaver", new ChainweaverWalletProvider())
    .register("devwallet", new DevWalletProvider());

  // Initialize and render
  walletManager.initialize().then(() => {
    root.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <WalletProvider walletManager={walletManager}>
            <App />
          </WalletProvider>
        </QueryClientProvider>
      </React.StrictMode>,
    );
  });
} catch (error) {
  console.error("Failed to render React app:", error);
  // Fallback content
  document.getElementById("root")!.innerHTML = `
    <div>
      <h1>Todo List</h1>
      <p>Error loading app: ${error}</p>
    </div>
  `;
}
