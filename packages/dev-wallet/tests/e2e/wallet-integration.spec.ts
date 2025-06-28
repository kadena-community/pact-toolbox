import { test, expect } from "@playwright/test";

test.describe("Dev Wallet Integration Tests", () => {
  test("should connect wallet and display account", async ({ page }) => {
    await page.goto("/");
    
    // Wait for page to load
    await expect(page.locator("h1")).toHaveText("Dev Wallet Test Page");
    
    // Connect wallet
    await page.locator('button:has-text("Connect Wallet")').click();
    
    // Check that status updates with connection
    const status = page.locator("#status");
    await expect(status).toContainText("Connected:");
    
    // Check that output shows account info
    await expect(page.locator("#output")).toContainText("Connected");
    await expect(page.locator("#output")).toContainText("address");
  });

  test("should get accounts after connecting", async ({ page }) => {
    await page.goto("/");
    
    // First connect
    await page.locator('button:has-text("Connect Wallet")').click();
    await expect(page.locator("#status")).toContainText("Connected:");
    
    // Get accounts
    await page.locator('button:has-text("Get Accounts")').click();
    
    // Check status shows accounts found
    await expect(page.locator("#status")).toContainText("Found");
    await expect(page.locator("#status")).toContainText("accounts");
  });

  test("should handle sign transaction error when not connected", async ({ page }) => {
    await page.goto("/");
    
    // Try to sign without connecting
    await page.locator('button:has-text("Sign Transaction")').click();
    
    // Should show error in status
    await expect(page.locator("#status")).toContainText("Error:");
  });

  test("should sign transaction after connecting", async ({ page }) => {
    await page.goto("/");
    
    // Connect first
    await page.locator('button:has-text("Connect Wallet")').click();
    await expect(page.locator("#status")).toContainText("Connected:");
    
    // Sign transaction
    await page.locator('button:has-text("Sign Transaction")').click();
    
    // Check for success
    await expect(page.locator("#status")).toContainText("Transaction signed successfully");
    await expect(page.locator("#output")).toContainText("Signed Transaction");
  });

  test("should sign message after connecting", async ({ page }) => {
    await page.goto("/");
    
    // Connect first
    await page.locator('button:has-text("Connect Wallet")').click();
    await expect(page.locator("#status")).toContainText("Connected:");
    
    // Sign message
    await page.locator('button:has-text("Sign Message")').click();
    
    // Check for success
    await expect(page.locator("#status")).toContainText("Message signed successfully");
    await expect(page.locator("#output")).toContainText("Signature");
  });

  test("should disconnect wallet", async ({ page }) => {
    await page.goto("/");
    
    // Connect first
    await page.locator('button:has-text("Connect Wallet")').click();
    await expect(page.locator("#status")).toContainText("Connected:");
    
    // Disconnect
    await page.locator('button:has-text("Disconnect")').click();
    
    // Check status
    await expect(page.locator("#status")).toContainText("Disconnected");
    await expect(page.locator("#output")).toContainText("Disconnected");
  });

  test("wallet container should be present", async ({ page }) => {
    await page.goto("/");
    
    // Check that the custom element exists
    const walletContainer = page.locator("toolbox-wallet-container");
    await expect(walletContainer).toHaveCount(1);
    
    // Check it has the correct ID
    await expect(page.locator("#wallet")).toHaveCount(1);
  });
});