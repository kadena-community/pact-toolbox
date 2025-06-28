import { test, expect } from '@playwright/test';

test('Todo app loads without network', async ({ page }) => {
  // Navigate to the todo app
  await page.goto('http://localhost:5173');
  
  // Check if the application title is visible
  await expect(page.locator('h1')).toHaveText('Todo MVC');
  
  // Check if the todo input is visible
  await expect(page.locator('input[placeholder="Add a new todo..."]')).toBeVisible();
  
  // Check if the todo list container is visible
  await expect(page.locator('.todo-list')).toBeVisible();
});