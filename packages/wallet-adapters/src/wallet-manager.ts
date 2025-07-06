import type { 
  IWalletManager, 
  IWalletManagerEvents,
  IEventBus, 
  Wallet 
} from "@pact-toolbox/types";
import { EventBus } from "@pact-toolbox/utils";

/**
 * Default wallet manager implementation
 */
export class WalletManager implements IWalletManager {
  private currentWallet: Wallet | null = null;
  private availableWallets: Map<string, Wallet> = new Map();
  private modalOpen = false;
  private readonly eventBus: IEventBus;

  constructor(eventBus?: IEventBus) {
    this.eventBus = eventBus ?? new EventBus();
  }

  getCurrentWallet(): Wallet | null {
    return this.currentWallet;
  }

  setCurrentWallet(wallet: Wallet | null): void {
    const previousWallet = this.currentWallet;
    this.currentWallet = wallet;

    if (wallet !== previousWallet) {
      this.eventBus.emit<IWalletManagerEvents["wallet:changed"]>(
        "wallet:changed", 
        { wallet }
      );
    }

    if (wallet && !previousWallet) {
      this.eventBus.emit<IWalletManagerEvents["wallet:connected"]>(
        "wallet:connected",
        { wallet, isReconnect: false }
      );
    } else if (!wallet && previousWallet) {
      this.eventBus.emit<IWalletManagerEvents["wallet:disconnected"]>(
        "wallet:disconnected",
        { address: previousWallet.address }
      );
    }
  }

  getAvailableWallets(): Wallet[] {
    return Array.from(this.availableWallets.values());
  }

  addWallet(wallet: Wallet): void {
    this.availableWallets.set(wallet.address, wallet);
  }

  removeWallet(address: string): void {
    const wallet = this.availableWallets.get(address);
    if (wallet) {
      this.availableWallets.delete(address);
      
      // If this was the current wallet, clear it
      if (this.currentWallet?.address === address) {
        this.setCurrentWallet(null);
      }
    }
  }

  isModalOpen(): boolean {
    return this.modalOpen;
  }

  openModal(provider?: string): void {
    this.modalOpen = true;
    this.eventBus.emit<IWalletManagerEvents["modal:open"]>(
      "modal:open",
      { provider }
    );
  }

  closeModal(): void {
    this.modalOpen = false;
    this.eventBus.emit<IWalletManagerEvents["modal:close"]>("modal:close");
  }

  getEventBus(): IEventBus {
    return this.eventBus;
  }

  /**
   * Clear all wallets and reset state
   */
  clear(): void {
    this.currentWallet = null;
    this.availableWallets.clear();
    this.modalOpen = false;
    this.eventBus.clear();
  }
}

/**
 * Create a wallet manager with optional event bus
 */
export function createWalletManager(eventBus?: IEventBus): IWalletManager {
  return new WalletManager(eventBus);
}