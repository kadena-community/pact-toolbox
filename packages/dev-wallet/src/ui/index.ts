// Export UI components if in browser environment
export * from "./types";

// Import theme provider from ui-shared
import "@pact-toolbox/ui-shared/themes";

// Import all components to ensure they're registered
import "./components/toolbox-wallet";
import "./components/toolbox-wallet-container";
import "./components/toolbox-wallet-floating-button";
import "./components/wallet-header";
import "./components/bottom-navigation";
import "./screens/accounts-screen";
import "./screens/connect-screen";
import "./screens/networks-screen";
import "./screens/settings-screen";
import "./screens/sign-screen";
import "./screens/transactions-screen";

// Auto-initialize floating button on DOM load
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Ensure floating button exists when DOM is ready
  const initFloatingButton = () => {
    if (!document.querySelector('toolbox-wallet-floating-button')) {
      const floatingButton = document.createElement('toolbox-wallet-floating-button');
      document.body.appendChild(floatingButton);
      console.log('Dev wallet floating button auto-initialized');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingButton);
  } else {
    // DOM is already loaded
    initFloatingButton();
  }
}

