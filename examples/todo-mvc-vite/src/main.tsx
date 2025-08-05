import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import { queryClient } from "./api/queryClient";
import { PactToolboxProvider } from "@pact-toolbox/context/react";

import App from "./App.tsx";

// Add error boundary to catch any rendering errors
try {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <PactToolboxProvider
        config={{
          autoDetectEnvironment: true,
          enableWalletUI: true,
          autoConnectWallet: true,
          devMode: true,
        }}
      >
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </PactToolboxProvider>
    </React.StrictMode>,
  );
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
