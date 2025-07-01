import { render } from "solid-js/web";
import { createSignal, createRoot } from "solid-js";
import { ThemeProvider, PactModal, ToastProvider } from "@pact-toolbox/ui-shared";
import { WalletSelector } from "./components/wallet-selector";
import { NetworkSelector } from "./components/network-selector";

interface ShowWalletSelectorModalOptions {
  container: HTMLElement;
  theme?: "light" | "dark" | "auto";
  title?: string;
  description?: string;
  walletManager?: any;
}

interface ShowNetworkSelectorModalOptions {
  container: HTMLElement;
  theme?: "light" | "dark" | "auto";
  title?: string;
  description?: string;
}

export function showWalletSelectorModal(options: ShowWalletSelectorModalOptions): Promise<string | null> {
  const {
    container,
    theme = "auto",
    title = "Connect your wallet",
    description = "Please select a wallet to connect",
    walletManager,
  } = options;

  return new Promise((resolve) => {
    let disposeRoot: (() => void) | null = null;
    let isCleaningUp = false;

    const cleanup = () => {
      if (isCleaningUp || !disposeRoot) return;
      isCleaningUp = true;

      try {
        disposeRoot();
      } catch (error) {
        console.warn("Error during modal disposal:", error);
      }

      disposeRoot = null;
      container.innerHTML = "";
    };

    disposeRoot = createRoot((dispose) => {
      const [isOpen, setIsOpen] = createSignal(true);

      const handleWalletConnected = () => {
        if (isCleaningUp) return;
        setIsOpen(false);
        setTimeout(() => {
          cleanup();
          resolve("connected");
        }, 150);
      };

      const handleClose = () => {
        if (isCleaningUp) return;
        setIsOpen(false);
        setTimeout(() => {
          cleanup();
          resolve(null);
        }, 150);
      };

      // Render the modal
      render(
        () => (
          <ToastProvider>
            <ThemeProvider theme={theme}>
              <PactModal open={isOpen()} title={title} onClose={handleClose} maxWidth="sm">
                <WalletSelector
                  onWalletConnected={handleWalletConnected}
                  walletManager={walletManager}
                  description={description}
                />
              </PactModal>
            </ThemeProvider>
          </ToastProvider>
        ),
        container,
      );

      return dispose;
    });
  });
}

export function showNetworkSelectorModal(options: ShowNetworkSelectorModalOptions): Promise<string | null> {
  const { container, theme = "auto", title = "Select network", description } = options;

  return new Promise((resolve) => {
    let disposeRoot: (() => void) | null = null;
    let isCleaningUp = false;

    const cleanup = () => {
      if (isCleaningUp || !disposeRoot) return;
      isCleaningUp = true;

      try {
        disposeRoot();
      } catch (error) {
        console.warn("Error during modal disposal:", error);
      }

      disposeRoot = null;
      container.innerHTML = "";
    };

    disposeRoot = createRoot((dispose) => {
      const [isOpen, setIsOpen] = createSignal(true);

      const handleNetworkSwitch = (networkId: string) => {
        if (isCleaningUp) return;
        setIsOpen(false);
        setTimeout(() => {
          cleanup();
          resolve(networkId);
        }, 150);
      };

      const handleClose = () => {
        if (isCleaningUp) return;
        setIsOpen(false);
        setTimeout(() => {
          cleanup();
          resolve(null);
        }, 150);
      };

      // Render the modal
      render(
        () => (
          <ToastProvider>
            <ThemeProvider theme={theme}>
              <PactModal open={isOpen()} title={title} onClose={handleClose} maxWidth="sm">
                <NetworkSelector
                  currentNetwork={null}
                  supportedNetworks={["testnet", "mainnet", "development"]}
                  canSwitch={true}
                  onNetworkSwitch={handleNetworkSwitch}
                  description={description}
                />
              </PactModal>
            </ThemeProvider>
          </ToastProvider>
        ),
        container,
      );

      return dispose;
    });
  });
}
