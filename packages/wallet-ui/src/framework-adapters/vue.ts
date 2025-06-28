import { ref, onMounted, onUnmounted, provide, inject, type InjectionKey } from "vue";
import { ModalManager, type ModalManagerOptions } from "../modal-manager";

interface WalletModalContext {
  modalManager: ModalManager;
  showWalletSelector: () => Promise<string | null>;
  setTheme: (theme: "light" | "dark") => void;
}

const WalletModalKey: InjectionKey<WalletModalContext> = Symbol("wallet-modal");

/**
 * Composable to provide wallet modal functionality
 */
export function provideWalletModal(options?: { modalOptions?: ModalManagerOptions }) {
  const modalManager = ModalManager.getInstance(options?.modalOptions);

  onMounted(() => {
    modalManager.initialize();
  });

  onUnmounted(() => {
    modalManager.cleanup();
  });

  const context: WalletModalContext = {
    modalManager,
    showWalletSelector: () => modalManager.showWalletSelector(),
    setTheme: (theme) => modalManager.setTheme(theme),
  };

  provide(WalletModalKey, context);

  return context;
}

/**
 * Composable to inject wallet modal functionality
 */
export function useWalletModal() {
  const context = inject(WalletModalKey);

  if (!context) {
    throw new Error("useWalletModal must be used within a component that calls provideWalletModal");
  }

  return context;
}

/**
 * Composable for wallet selector
 */
export function useWalletSelector() {
  const { showWalletSelector } = useWalletModal();
  const isOpen = ref(false);
  const error = ref<string | null>(null);

  const openSelector = async () => {
    isOpen.value = true;
    error.value = null;

    try {
      const walletId = await showWalletSelector();
      if (walletId) {
        return walletId;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to select wallet";
    } finally {
      isOpen.value = false;
    }

    return null;
  };

  return {
    openSelector,
    isOpen,
    error,
  };
}

/**
 * Composable for auto-connect functionality
 */
export function useAutoConnect() {
  const { modalManager } = useWalletModal();
  const checking = ref(true);
  const connected = ref(false);

  onMounted(async () => {
    try {
      const { walletService } = await import("@pact-toolbox/wallet-adapters");

      if (!walletService.getPrimaryWallet()) {
        const walletId = await modalManager.showWalletSelector();
        if (walletId) {
          await modalManager.connectWallet(walletId);
          connected.value = true;
        }
      } else {
        connected.value = true;
      }
    } catch (error) {
      console.error("Auto-connect failed:", error);
    } finally {
      checking.value = false;
    }
  });

  return {
    checking,
    connected,
  };
}

/**
 * Composable for theme management
 */
export function useWalletTheme() {
  const { setTheme } = useWalletModal();
  const currentTheme = ref<"light" | "dark">("light");

  const toggleTheme = () => {
    currentTheme.value = currentTheme.value === "light" ? "dark" : "light";
    setTheme(currentTheme.value);
  };

  const applyTheme = (theme: "light" | "dark") => {
    currentTheme.value = theme;
    setTheme(theme);
  };

  // Auto-detect theme preference
  onMounted(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  });

  return {
    currentTheme,
    toggleTheme,
    applyTheme,
  };
}
