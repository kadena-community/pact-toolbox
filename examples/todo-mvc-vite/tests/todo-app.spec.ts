import { test, expect } from "@playwright/test";

test.describe("Todo MVC App", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5174/");
  });

  test("should display the todo app", async ({ page }) => {
    // Check that the app loads
    await expect(page.locator("h1")).toContainText("todos");
  });

  test("should create a new todo", async ({ page }) => {
    // Create a new todo
    const todoInput = page.locator("input.new-todo");
    await todoInput.fill("Test todo item");
    await todoInput.press("Enter");

    // Verify the todo was created
    const todoItem = page.locator(".todo-list li").first();
    await expect(todoItem).toContainText("Test todo item");
  });

  test("should toggle todo completion", async ({ page }) => {
    // Create a todo first
    const todoInput = page.locator("input.new-todo");
    await todoInput.fill("Toggle test todo");
    await todoInput.press("Enter");

    // Toggle completion
    const toggle = page.locator(".todo-list li").first().locator(".toggle");
    await toggle.click();

    // Verify it's marked as completed
    const todoItem = page.locator(".todo-list li").first();
    await expect(todoItem).toHaveClass(/completed/);
  });

  test("should delete a todo", async ({ page }) => {
    // Create a todo first
    const todoInput = page.locator("input.new-todo");
    await todoInput.fill("Delete test todo");
    await todoInput.press("Enter");

    // Hover to show delete button and click it
    const todoItem = page.locator(".todo-list li").first();
    await todoItem.hover();
    await todoItem.locator(".destroy").click();

    // Verify the todo was deleted
    await expect(page.locator(".todo-list li")).toHaveCount(0);
  });

  test("should filter todos", async ({ page }) => {
    // Create multiple todos
    const todoInput = page.locator("input.new-todo");
    await todoInput.fill("Active todo");
    await todoInput.press("Enter");

    await todoInput.fill("Completed todo");
    await todoInput.press("Enter");

    // Complete the second todo
    await page.locator(".todo-list li").nth(1).locator(".toggle").click();

    // Test filters
    await page.locator('a:text("Active")').click();
    await expect(page.locator(".todo-list li")).toHaveCount(1);
    await expect(page.locator(".todo-list li")).toContainText("Active todo");

    await page.locator('a:text("Completed")').click();
    await expect(page.locator(".todo-list li")).toHaveCount(1);
    await expect(page.locator(".todo-list li")).toContainText("Completed todo");

    await page.locator('a:text("All")').click();
    await expect(page.locator(".todo-list li")).toHaveCount(2);
  });
});
