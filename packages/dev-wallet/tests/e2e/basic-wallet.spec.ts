import { test, expect } from "@playwright/test";

test.describe("Basic Dev Wallet Tests", () => {
  test("should load test page", async ({ page }) => {
    // Navigate to the test page
    await page.goto("/");

    // Check that the page has loaded
    await expect(page.locator("h1")).toHaveText("Dev Wallet Test Page");

    // Check that the status element exists
    const status = page.locator("#status");
    await expect(status).toBeVisible();
    await expect(status).toContainText("Status:");
  });

  test("should have control buttons", async ({ page }) => {
    await page.goto("/");

    // Check that control buttons exist
    await expect(page.locator('button:has-text("Connect Wallet")')).toBeVisible();
    await expect(page.locator('button:has-text("Get Accounts")')).toBeVisible();
    await expect(page.locator('button:has-text("Sign Transaction")')).toBeVisible();
    await expect(page.locator('button:has-text("Sign Message")')).toBeVisible();
    await expect(page.locator('button:has-text("Disconnect")')).toBeVisible();
  });

  test("should have wallet container element", async ({ page }) => {
    await page.goto("/");

    // Check that the wallet container element exists
    const walletContainer = page.locator("#wallet");
    await expect(walletContainer).toHaveCount(1);

    // Check that it's the correct custom element
    const tagName = await walletContainer.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe("toolbox-wallet-container");
  });
});
