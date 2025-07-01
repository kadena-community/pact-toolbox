import type { WalletErrorType } from "@pact-toolbox/types";

/**
 * User-friendly error messages
 */
export interface WalletErrorInfo {
  type: WalletErrorType;
  message: string;
  userMessage: string;
  action?: string;
  retryable?: boolean;
}

/**
 * Wallet error class with user-friendly messages
 */
export class WalletError extends Error implements WalletErrorInfo {
  public readonly type: WalletErrorType;
  public readonly userMessage: string;
  public readonly action?: string;
  public readonly retryable: boolean;
  public readonly cause?: unknown;

  constructor(info: WalletErrorInfo, cause?: unknown) {
    super(info.message);
    this.name = "WalletError";
    this.type = info.type;
    this.userMessage = info.userMessage;
    this.action = info.action;
    this.retryable = info.retryable ?? true;
    this.cause = cause;
  }

  static notFound(walletId: string): WalletError {
    const walletNames: Record<string, string> = {
      ecko: "Ecko Wallet",
      chainweaver: "Chainweaver",
      zelcore: "Zelcore",
      walletconnect: "WalletConnect",
      keypair: "Development Wallet",
      magic: "Magic Link",
    };

    const walletName = walletNames[walletId] || walletId;
    const installLinks: Record<string, string> = {
      ecko: "https://ecko.finance",
      chainweaver: "https://www.kadena.io/chainweaver",
      zelcore: "https://zelcore.io",
    };

    return new WalletError({
      type: "NOT_FOUND",
      message: `Wallet "${walletId}" not found or not installed`,
      userMessage: `${walletName} is not installed or not available`,
      action: installLinks[walletId]
        ? `Install ${walletName} from ${installLinks[walletId]}`
        : `Make sure ${walletName} is installed and running`,
      retryable: true,
    });
  }

  static notConnected(walletId: string): WalletError {
    return new WalletError({
      type: "NOT_CONNECTED",
      message: `Wallet "${walletId}" is not connected`,
      userMessage: "Wallet is not connected",
      action: "Please connect your wallet first",
      retryable: true,
    });
  }

  static connectionFailed(reason: string, walletId?: string): WalletError {
    const commonReasons: Record<string, string> = {
      "User rejected": "You cancelled the connection request",
      Timeout: "Connection timed out. Please try again",
      "Network error": "Network error. Please check your connection",
      "Desktop app not running": "Please make sure the desktop app is running",
    };

    const userMessage =
      Object.entries(commonReasons).find(([key]) => reason.toLowerCase().includes(key.toLowerCase()))?.[1] ||
      "Unable to connect to wallet";

    return new WalletError({
      type: "CONNECTION_FAILED",
      message: `Connection failed: ${reason}`,
      userMessage,
      action:
        walletId === "chainweaver" || walletId === "zelcore"
          ? "Make sure the desktop application is running"
          : "Please try connecting again",
      retryable: true,
    });
  }

  static userRejected(operation: string): WalletError {
    return new WalletError({
      type: "USER_REJECTED",
      message: `User rejected ${operation}`,
      userMessage: `You cancelled the ${operation}`,
      retryable: true,
    });
  }

  static signingFailed(reason: string): WalletError {
    return new WalletError({
      type: "SIGNING_FAILED",
      message: `Transaction signing failed: ${reason}`,
      userMessage: "Failed to sign the transaction",
      action: "Please try again or check your wallet",
      retryable: true,
    });
  }

  static networkMismatch(expected: string, actual: string): WalletError {
    return new WalletError({
      type: "NETWORK_MISMATCH",
      message: `Network mismatch: expected ${expected}, got ${actual}`,
      userMessage: `Wrong network: please switch to ${expected}`,
      action: `Switch your wallet to the ${expected} network`,
      retryable: true,
    });
  }

  static timeout(operation: string, duration: number): WalletError {
    return new WalletError({
      type: "TIMEOUT",
      message: `${operation} timed out after ${duration}ms`,
      userMessage: `${operation} took too long`,
      action: "Please try again",
      retryable: true,
    });
  }

  static unknown(message: string, cause?: unknown): WalletError {
    return new WalletError(
      {
        type: "UNKNOWN",
        message,
        userMessage: "An unexpected error occurred",
        action: "Please try again or contact support",
        retryable: true,
      },
      cause,
    );
  }
}

/**
 * Helper to format error for display
 */
export function formatWalletError(error: unknown): {
  title: string;
  message: string;
  action?: string;
  retryable: boolean;
} {
  if (error instanceof WalletError) {
    return {
      title: getErrorTitle(error.type),
      message: error.userMessage,
      action: error.action,
      retryable: error.retryable,
    };
  }

  if (error instanceof Error) {
    return {
      title: "Error",
      message: error.message,
      retryable: true,
    };
  }

  return {
    title: "Error",
    message: String(error),
    retryable: true,
  };
}

function getErrorTitle(type: WalletErrorType): string {
  const titles: Record<WalletErrorType, string> = {
    NOT_FOUND: "Wallet Not Found",
    NOT_CONNECTED: "Not Connected",
    CONNECTION_FAILED: "Connection Failed",
    USER_REJECTED: "Request Cancelled",
    SIGNING_FAILED: "Signing Failed",
    NETWORK_MISMATCH: "Wrong Network",
    TIMEOUT: "Request Timed Out",
    UNKNOWN: "Error",
  };
  return titles[type] || "Error";
}
