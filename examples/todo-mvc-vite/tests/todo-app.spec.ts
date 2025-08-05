import { test, expect } from "@playwright/test";

test.describe("Todo MVC App", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173/");
  });

  test("should display the todo app", async ({ page }) => {
    // Wait for any content to load
    await page.waitForTimeout(2000);
    
    // Debug: check what's actually on the page
    const bodyContent = await page.locator("body").textContent();
    console.log("Page body content:", bodyContent);
    
    const htmlContent = await page.content();
    console.log("Full HTML:", htmlContent.substring(0, 1000));
    
    // Check if there are any console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser error:', msg.text());
      }
    });
    
    // Check that the app loads
    await expect(page.locator("h1")).toContainText("Todo List");
  });

  test("should create a new todo", async ({ page }) => {
    // Wait for the app to load
    await expect(page.locator("h1")).toContainText("Todo List");
    
    // Create a new todo using the actual form structure
    const todoInput = page.locator("input[placeholder*='Add a new todo']");
    await todoInput.fill("Test todo item");
    
    const addButton = page.locator("button:has-text('Add')");
    await addButton.click();

    // Verify the todo was created
    const todoItem = page.locator(".todo-list li").first();
    await expect(todoItem).toContainText("Test todo item");
  });

  test("should toggle todo completion", async ({ page }) => {
    // Wait for the app to load
    await expect(page.locator("h1")).toContainText("Todo List");
    
    // Create a todo first
    const todoInput = page.locator("input[placeholder*='Add a new todo']");
    await todoInput.fill("Toggle test todo");
    
    const addButton = page.locator("button:has-text('Add')");
    await addButton.click();

    // Wait for todo to appear
    await expect(page.locator(".todo-list li")).toHaveCount(1);

    // Toggle completion using the checkbox
    const checkbox = page.locator(".todo-list li").first().locator("input.todo-checkbox");
    await checkbox.click();

    // Verify it's marked as completed
    const todoItem = page.locator(".todo-list li").first();
    await expect(todoItem).toHaveClass(/completed/, { timeout: 10000 });
  });

  test("should delete a todo", async ({ page }) => {
    // Wait for the app to load
    await expect(page.locator("h1")).toContainText("Todo List");
    
    // Create a todo first
    const todoInput = page.locator("input[placeholder*='Add a new todo']");
    await todoInput.fill("Delete test todo");
    
    const addButton = page.locator("button:has-text('Add')");
    await addButton.click();

    // Wait for todo to appear
    await expect(page.locator(".todo-list li")).toHaveCount(1);

    // Handle confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    // Click the delete button
    const deleteButton = page.locator(".todo-list li").first().locator("button.delete-button");
    await deleteButton.click();

    // Verify the todo was deleted
    await expect(page.locator(".todo-list li")).toHaveCount(0, { timeout: 10000 });
  });

  test("should create multiple todos", async ({ page }) => {
    // Wait for the app to load
    await expect(page.locator("h1")).toContainText("Todo List");
    
    const todoInput = page.locator("input[placeholder*='Add a new todo']");
    const addButton = page.locator("button:has-text('Add')");
    
    // Create multiple todos
    await todoInput.fill("First todo");
    await addButton.click();

    await todoInput.fill("Second todo");
    await addButton.click();

    // Verify both todos were created
    await expect(page.locator(".todo-list li")).toHaveCount(2);
    await expect(page.locator(".todo-list li")).toContainText("First todo");
    await expect(page.locator(".todo-list li")).toContainText("Second todo");
  });
});
