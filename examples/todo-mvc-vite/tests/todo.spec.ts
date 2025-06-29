import { test, expect } from "@playwright/test";

test.describe("Todo MVC Application", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto("http://localhost:5173");

    // Wait for the page to load
    await page.waitForLoadState("networkidle");
  });

  test("should display the application title and initial UI", async ({ page }) => {
    // Check if the page loads correctly
    await expect(page).toHaveTitle("Vite + React + TS");

    // Check if main elements are present
    await expect(page.locator("h1")).toContainText("Todo List");
    await expect(page.locator('input[placeholder="Add a new todo..."]')).toBeVisible();
  });

  test("should allow creating a new todo", async ({ page }) => {
    const todoInput = page.locator('input[placeholder="Add a new todo..."]');
    const todoText = "Test Todo Item";

    // Type in the todo input
    await todoInput.fill(todoText);
    await todoInput.press("Enter");

    // Check if the todo appears in the list
    await expect(page.locator("li")).toContainText(todoText);
  });

  test("should allow toggling todo completion status", async ({ page }) => {
    const todoInput = page.locator('input[placeholder="Add a new todo..."]');
    const todoText = "Toggle Test Todo";

    // Create a todo
    await todoInput.fill(todoText);
    await todoInput.press("Enter");

    // Find the todo item and its checkbox
    const todoItem = page.locator("li").filter({ hasText: todoText });
    const checkbox = todoItem.locator('input[type="checkbox"]');

    // Click the checkbox to mark as complete
    await checkbox.click();

    // Verify the todo is marked as completed
    await expect(todoItem).toHaveClass(/completed/);

    // Click again to unmark
    await checkbox.click();

    // Verify the todo is no longer marked as completed
    await expect(todoItem).not.toHaveClass(/completed/);
  });

  test("should allow deleting a todo", async ({ page }) => {
    const todoInput = page.locator('input[placeholder="Add a new todo..."]');
    const todoText = "Delete Test Todo";

    // Create a todo
    await todoInput.fill(todoText);
    await todoInput.press("Enter");

    // Find the todo item
    const todoItem = page.locator("li").filter({ hasText: todoText });

    // Hover over the todo to reveal the delete button
    await todoItem.hover();

    // Click the delete button
    const deleteButton = todoItem.locator("button", { hasText: /delete|×|remove/i });
    await deleteButton.click();

    // Verify the todo is removed
    await expect(page.locator("li").filter({ hasText: todoText })).not.toBeVisible();
  });

  test("should allow editing a todo", async ({ page }) => {
    const todoInput = page.locator('input[placeholder="Add a new todo..."]');
    const originalText = "Original Todo";
    const editedText = "Edited Todo";

    // Create a todo
    await todoInput.fill(originalText);
    await todoInput.press("Enter");

    // Find the todo item and double-click to edit
    const todoItem = page.locator("li").filter({ hasText: originalText });
    await todoItem.dblclick();

    // Find the edit input and change the text
    const editInput = todoItem.locator('input[type="text"]');
    await editInput.fill(editedText);
    await editInput.press("Enter");

    // Verify the todo text has been updated
    await expect(page.locator("li")).toContainText(editedText);
    await expect(page.locator("li")).not.toContainText(originalText);
  });

  test("should show todo count", async ({ page }) => {
    const todoInput = page.locator('input[placeholder="Add a new todo..."]');

    // Create multiple todos
    await todoInput.fill("Todo 1");
    await todoInput.press("Enter");

    await todoInput.fill("Todo 2");
    await todoInput.press("Enter");

    await todoInput.fill("Todo 3");
    await todoInput.press("Enter");

    // Check if the counter shows correct number
    const counter = page.locator("span").filter({ hasText: /\d+ items? left/ });
    await expect(counter).toContainText("3");
  });

  test("should filter todos by status", async ({ page }) => {
    const todoInput = page.locator('input[placeholder="Add a new todo..."]');

    // Create multiple todos
    await todoInput.fill("Active Todo");
    await todoInput.press("Enter");

    await todoInput.fill("Completed Todo");
    await todoInput.press("Enter");

    // Mark one as completed
    const completedTodo = page.locator("li").filter({ hasText: "Completed Todo" });
    await completedTodo.locator('input[type="checkbox"]').click();

    // Test "Active" filter
    await page.locator("a", { hasText: "Active" }).click();
    await expect(page.locator("li").filter({ hasText: "Active Todo" })).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Completed Todo" })).not.toBeVisible();

    // Test "Completed" filter
    await page.locator("a", { hasText: "Completed" }).click();
    await expect(page.locator("li").filter({ hasText: "Completed Todo" })).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Active Todo" })).not.toBeVisible();

    // Test "All" filter
    await page.locator("a", { hasText: "All" }).click();
    await expect(page.locator("li").filter({ hasText: "Active Todo" })).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Completed Todo" })).toBeVisible();
  });
});
