import React from "react";
import { useWallet, useWalletConnection, useAvailableWallets } from "@pact-toolbox/wallet-adapters";

export function WalletConnect() {
  const { wallet, error } = useWallet();
  const { isConnected, isConnecting, connect, disconnect } = useWalletConnection();
  const availableWallets = useAvailableWallets();

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      console.error("Failed to connect:", err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  if (isConnected && wallet) {
    return (
      <div style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "1rem" }}>
        <div style={{ marginBottom: "0.5rem" }}>
          <strong>Connected:</strong> {wallet.id || "Unknown Wallet"}
        </div>
        <button onClick={handleDisconnect} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "1rem" }}>
      <div style={{ marginBottom: "0.5rem" }}>
        <strong>Available Wallets:</strong> {availableWallets.length > 0 ? availableWallets.map(w => w.name).join(", ") : "None"}
      </div>
      {error && (
        <div style={{ color: "red", marginBottom: "0.5rem" }}>
          Error: {error.message}
        </div>
      )}
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        style={{ padding: "0.5rem 1rem", cursor: isConnecting ? "not-allowed" : "pointer" }}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
    </div>
  );
}