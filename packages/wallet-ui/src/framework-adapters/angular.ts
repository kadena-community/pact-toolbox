import { Injectable, OnDestroy, signal, computed, Component, Output, EventEmitter, inject } from "@angular/core";
import { ModalManager, type ModalManagerOptions } from "../modal-manager";

@Injectable({
  providedIn: "root",
})
export class WalletModalService implements OnDestroy {
  private modalManager: ModalManager;

  // Signals
  private readonly _isOpen = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _theme = signal<"light" | "dark">("light");

  // Public readonly signals
  readonly isOpen = this._isOpen.asReadonly();
  readonly error = this._error.asReadonly();
  readonly theme = this._theme.asReadonly();

  constructor() {
    this.modalManager = ModalManager.getInstance();
  }

  initialize(_options?: { modalOptions?: ModalManagerOptions }) {
    this.modalManager.initialize();
  }

  async showWalletSelector(): Promise<string | null> {
    this._isOpen.set(true);
    this._error.set(null);

    try {
      return await this.modalManager.showWalletSelector();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to select wallet";
      this._error.set(message);
      throw error;
    } finally {
      this._isOpen.set(false);
    }
  }

  setTheme(theme: "light" | "dark"): void {
    this._theme.set(theme);
    this.modalManager.setTheme(theme);
  }

  toggleTheme(): void {
    const newTheme = this._theme() === "light" ? "dark" : "light";
    this.setTheme(newTheme);
  }

  async connectWallet(walletId: string): Promise<boolean> {
    return this.modalManager.connectWallet(walletId);
  }

  ngOnDestroy(): void {
    this.modalManager.cleanup();
  }
}

/**
 * Angular component for connect wallet button
 */
@Component({
  selector: "pact-connect-wallet",
  standalone: true,
  template: `
    <button (click)="connect()" [disabled]="isConnecting()">
      {{ isConnecting() ? "Connecting..." : "Connect Wallet" }}
    </button>
  `,
})
export class ConnectWalletComponent {
  private walletModal = inject(WalletModalService);

  @Output() connected = new EventEmitter<string>();
  @Output() connectionError = new EventEmitter<Error>();

  isConnecting = computed(() => this.walletModal.isOpen());

  async connect() {
    try {
      const walletId = await this.walletModal.showWalletSelector();
      if (walletId) {
        await this.walletModal.connectWallet(walletId);
        this.connected.emit(walletId);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      if (error instanceof Error) {
        this.connectionError.emit(error);
      }
    }
  }
}

/**
 * Convenience function to provide wallet modal in component
 */
export function provideWalletModal(options?: { modalOptions?: ModalManagerOptions }) {
  return {
    providers: [
      {
        provide: WalletModalService,
        useFactory: () => {
          const service = new WalletModalService();
          service.initialize(options);
          return service;
        },
      },
    ],
  };
}
