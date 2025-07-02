/**
 * Example: Using DevWallet with Local Networks
 * 
 * This example shows how the wallet system automatically enables
 * DevWallet UI when running against local development networks.
 */

import { createWalletSystem } from "@pact-toolbox/wallet-adapters";
import { execution } from "@pact-toolbox/transaction";

async function example() {
  // 1. Default behavior - auto-detects local network from RPC URL
  const system1 = await createWalletSystem({
    wallets: {
      keypair: {
        networkId: "development",
        rpcUrl: "http://localhost:8080", // Local URL triggers DevWallet UI
      }
    }
  });

  // Connect will show DevWallet UI in browser
  const wallet1 = await system1.connect("keypair");

  // 2. Explicitly disable UI for local network
  const system2 = await createWalletSystem({
    wallets: {
      keypair: {
        networkId: "development", 
        rpcUrl: "http://localhost:8080",
        showUI: false, // Explicitly disable UI
      }
    }
  });

  // Connect without UI even on local network
  const wallet2 = await system2.connect("keypair");

  // 3. Enable UI for non-local network (e.g., testnet)
  const system3 = await createWalletSystem({
    wallets: {
      keypair: {
        networkId: "testnet04",
        rpcUrl: "https://api.testnet.chainweb.com",
        showUI: true, // Force UI even for remote network
      }
    }
  });

  // 4. Transaction builder integration
  // When using local network, automatically uses keypair wallet
  const result = await execution('(+ 1 2)')
    .sign() // Auto-selects keypair for local development
    .submitAndListen();

  // 5. Test environment - no UI regardless of network
  process.env.NODE_ENV = "test";
  
  const testSystem = await createWalletSystem({
    wallets: {
      keypair: {
        networkId: "development",
        rpcUrl: "http://localhost:8080",
        // showUI setting ignored in test environment
      }
    }
  });

  // Always uses keypair without UI in tests
  const testWallet = await testSystem.connect();
}

/**
 * DevWallet UI Features (when enabled):
 * 
 * 1. **Key Management**:
 *    - Generate new keypairs
 *    - Import existing private keys
 *    - Export keys for backup
 *    - Manage multiple accounts
 * 
 * 2. **Transaction Approval**:
 *    - Visual transaction preview
 *    - Capability review
 *    - Gas estimation
 *    - Network selection
 * 
 * 3. **Development Tools**:
 *    - Account funding for local networks
 *    - Transaction history
 *    - Network switching
 *    - Debug information
 * 
 * 4. **Auto-Detection Logic**:
 *    - localhost URLs → UI enabled
 *    - development/fast-development networkId → UI enabled  
 *    - Remote URLs → UI disabled (unless forced)
 *    - Test environment → Always disabled
 */

// Network detection examples:
const examples = {
  // These auto-enable DevWallet UI:
  local1: { rpcUrl: "http://localhost:8080" },        // ✅ UI enabled
  local2: { rpcUrl: "http://127.0.0.1:8080" },       // ✅ UI enabled
  local3: { networkId: "development" },                // ✅ UI enabled
  local4: { networkId: "fast-development" },           // ✅ UI enabled

  // These don't enable UI by default:
  mainnet: { networkId: "mainnet01" },                 // ❌ UI disabled
  testnet: { networkId: "testnet04" },                 // ❌ UI disabled
  remote: { rpcUrl: "https://api.chainweb.com" },      // ❌ UI disabled
};