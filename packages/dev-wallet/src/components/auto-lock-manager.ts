import type { WalletStateManager } from "../services/wallet-state-manager";
import type { ErrorHandler } from "../utils/error-handler";

/**
 * Auto-lock manager for wallet security
 */
export class AutoLockManager {
  private stateManager: WalletStateManager;
  private errorHandler?: ErrorHandler;
  private autoLockTimer: NodeJS.Timeout | null = null;
  private activityListeners: Map<string, EventListener> = new Map();
  private isInitialized = false;
  private readonly DEFAULT_LOCK_TIMEOUT = 300000; // 5 minutes in milliseconds

  constructor(stateManager: WalletStateManager, errorHandler?: ErrorHandler) {
    this.stateManager = stateManager;
    this.errorHandler = errorHandler;
  }

  /**
   * Initialize auto-lock functionality
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing auto-lock manager...');
      
      // Get current settings
      const state = this.stateManager.getState();
      const autoLockEnabled = state.settings?.autoLock ?? false;

      if (autoLockEnabled) {
        this.startAutoLock();
        this.setupActivityListeners();
      }

      // Listen for settings changes
      this.stateManager.subscribe((newState) => {
        this.handleSettingsChange(newState.settings?.autoLock ?? false);
      });

      this.isInitialized = true;
      console.log('Auto-lock manager initialized');
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'AutoLockManager',
          operation: 'initialize',
        });
      } else {
        console.error('Error in AutoLockManager.initialize:', error);
      }
    }
  }

  /**
   * Cleanup auto-lock functionality
   */
  cleanup(): void {
    console.log('Cleaning up auto-lock manager...');
    
    this.stopAutoLock();
    this.removeActivityListeners();
    this.isInitialized = false;
    
    console.log('Auto-lock manager cleanup complete');
  }

  /**
   * Start auto-lock timer
   */
  startAutoLock(timeout?: number): void {
    this.stopAutoLock(); // Clear any existing timer
    
    const lockTimeout = timeout || this.DEFAULT_LOCK_TIMEOUT;
    
    console.log(`Starting auto-lock timer (${lockTimeout}ms)`);
    
    this.autoLockTimer = setTimeout(async () => {
      try {
        console.log('Auto-lock triggered - locking wallet');
        await this.stateManager.lockWallet();
        
        // Dispatch auto-lock event
        this.dispatchAutoLockEvent();
      } catch (error) {
        if (this.errorHandler) {
          await this.errorHandler.handle(error as Error, {
            component: 'AutoLockManager',
            operation: 'autoLockTrigger',
          });
        } else {
          console.error('Error in AutoLockManager.autoLockTrigger:', error);
        }
      }
    }, lockTimeout);
  }

  /**
   * Stop auto-lock timer
   */
  stopAutoLock(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
      console.log('Auto-lock timer stopped');
    }
  }

  /**
   * Reset auto-lock timer (restart countdown)
   */
  resetAutoLock(): void {
    const state = this.stateManager.getState();
    const autoLockEnabled = state.settings?.autoLock ?? false;
    
    if (autoLockEnabled && !state.isLocked) {
      this.startAutoLock();
    }
  }

  /**
   * Setup activity listeners to detect user interaction
   */
  private setupActivityListeners(): void {
    console.log('Setting up activity listeners for auto-lock');
    
    const activityEvents = [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    const activityHandler = this.throttle(() => {
      this.handleUserActivity();
    }, 1000); // Throttle to once per second

    for (const eventType of activityEvents) {
      document.addEventListener(eventType, activityHandler, true);
      this.activityListeners.set(eventType, activityHandler);
    }
  }

  /**
   * Remove activity listeners
   */
  private removeActivityListeners(): void {
    console.log('Removing activity listeners');
    
    for (const [eventType, listener] of this.activityListeners) {
      document.removeEventListener(eventType, listener, true);
    }
    
    this.activityListeners.clear();
  }

  /**
   * Handle user activity
   */
  private async handleUserActivity(): Promise<void> {
    try {
      const state = this.stateManager.getState();
      
      // Update last activity timestamp
      await this.stateManager.updateState({
        lastActivity: Date.now(),
      });

      // Reset auto-lock timer if enabled and not locked
      if (state.settings?.autoLock && !state.isLocked) {
        this.resetAutoLock();
      }
    } catch (error) {
      // Don't handle activity errors to avoid spam
      console.warn('Error handling user activity:', error);
    }
  }

  /**
   * Handle settings change for auto-lock
   */
  private handleSettingsChange(autoLockEnabled: boolean): void {
    console.log(`Auto-lock setting changed: ${autoLockEnabled}`);
    
    if (autoLockEnabled) {
      this.startAutoLock();
      this.setupActivityListeners();
    } else {
      this.stopAutoLock();
      this.removeActivityListeners();
    }
  }

  /**
   * Check if wallet should be locked due to inactivity
   */
  async checkForInactivityLock(): Promise<boolean> {
    try {
      const state = this.stateManager.getState();
      
      if (!state.settings?.autoLock || state.isLocked) {
        return false;
      }

      const lastActivity = state.lastActivity || 0;
      const inactivityTime = Date.now() - lastActivity;
      
      if (inactivityTime >= this.DEFAULT_LOCK_TIMEOUT) {
        console.log('Wallet locked due to inactivity');
        await this.stateManager.lockWallet();
        this.dispatchAutoLockEvent();
        return true;
      }

      return false;
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'AutoLockManager',
          operation: 'checkForInactivityLock',
        });
      } else {
        console.error('Error in AutoLockManager.checkForInactivityLock:', error);
      }
      return false;
    }
  }

  /**
   * Get remaining time until auto-lock
   */
  getRemainingLockTime(): number {
    const state = this.stateManager.getState();
    
    if (!state.settings?.autoLock || state.isLocked) {
      return 0;
    }

    const lastActivity = state.lastActivity || 0;
    const elapsed = Date.now() - lastActivity;
    const remaining = Math.max(0, this.DEFAULT_LOCK_TIMEOUT - elapsed);
    
    return remaining;
  }

  /**
   * Check if auto-lock is active
   */
  isAutoLockActive(): boolean {
    return this.autoLockTimer !== null;
  }

  /**
   * Force lock the wallet immediately
   */
  async forceLock(): Promise<void> {
    try {
      console.log('Force locking wallet');
      this.stopAutoLock();
      await this.stateManager.lockWallet();
      this.dispatchAutoLockEvent();
    } catch (error) {
      if (this.errorHandler) {
        await this.errorHandler.handle(error as Error, {
          component: 'AutoLockManager',
          operation: 'forceLock',
        });
      } else {
        console.error('Error in AutoLockManager.forceLock:', error);
      }
    }
  }

  /**
   * Dispatch auto-lock event
   */
  private dispatchAutoLockEvent(): void {
    const event = new CustomEvent('wallet-auto-locked', {
      detail: { timestamp: Date.now() },
      bubbles: true,
      composed: true,
    });
    document.dispatchEvent(event);
  }

  /**
   * Throttle function to limit execution frequency
   */
  private throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return function(this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}