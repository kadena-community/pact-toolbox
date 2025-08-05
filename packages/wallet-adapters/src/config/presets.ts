import type { TypeSafeWalletConfig } from "./types";
import { createWalletConfig } from "./builder";

/**
 * Development preset - includes keypair wallet with defaults
 */
export const developmentPreset: TypeSafeWalletConfig = createWalletConfig()
  .withKeypair({
    deterministic: true,
    accountName: "dev-account",
  })
  .withEcko()
  .withChainweaver()
  .withPreferences({
    autoConnect: true,
    rememberLast: true,
    preferredOrder: ["keypair", "ecko", "chainweaver"],
  })
  .withUI({
    showOnConnect: true,
    showInstallGuide: true,
  })
  .build();

/**
 * Production preset - excludes keypair wallet
 */
export const productionPreset: TypeSafeWalletConfig = createWalletConfig()
  .withEcko()
  .withChainweaver()
  .withZelcore()
  .withPreferences({
    autoConnect: true,
    rememberLast: true,
    preferredOrder: ["ecko", "chainweaver", "zelcore"],
    timeout: 30000,
  })
  .withUI({
    showOnConnect: true,
    showInstallGuide: true,
    theme: {
      theme: "auto",
    },
  })
  .build();

/**
 * Testing preset - minimal configuration
 */
export const testingPreset: TypeSafeWalletConfig = createWalletConfig()
  .withKeypair({
    deterministic: true,
    privateKey: "0000000000000000000000000000000000000000000000000000000000000000",
  })
  .withPreferences({
    autoConnect: false,
    rememberLast: false,
  })
  .withUI({
    showOnConnect: false,
  })
  .build();

/**
 * All wallets preset - requires WalletConnect and Magic configuration
 */
export function allWalletsPreset(
  walletConnectProjectId: string,
  magicApiKey: string
): TypeSafeWalletConfig {
  return createWalletConfig()
    .withKeypair()
    .withEcko()
    .withChainweaver()
    .withZelcore()
    .withWalletConnect({
      projectId: walletConnectProjectId,
      metadata: {
        name: "My dApp",
        description: "My decentralized application",
        url: window?.location?.origin || "http://localhost:3000",
        icons: ["https://my-dapp.com/icon.png"],
      },
    })
    .withMagic({
      apiKey: magicApiKey,
    })
    .withPreferences({
      autoConnect: true,
      rememberLast: true,
    })
    .withUI({
      showOnConnect: true,
      showInstallGuide: true,
    })
    .build();
}

/**
 * Get preset by environment
 */
export function getPresetForEnvironment(
  env: "development" | "production" | "test" = "development"
): TypeSafeWalletConfig {
  switch (env) {
    case "production":
      return productionPreset;
    case "test":
      return testingPreset;
    default:
      return developmentPreset;
  }
}