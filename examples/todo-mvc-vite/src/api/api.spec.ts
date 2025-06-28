import { createPactTestEnv } from "pact-toolbox";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTodo, deleteTodoById, editTodoById, getAllTodos, getTodoById, toggleTodoStatusById } from "./api";

describe("todos api", () => {
  let id: string;
  let title = "Learn pact";
  let env: any;

  beforeAll(async () => {
    id = crypto.randomUUID();
    env = await createPactTestEnv({
      network: "pactServer",
    });
    await env.start();
    await env.client.deployContract("todos.pact");
  });

  afterAll(async () => {
    if (env) {
      await env.stop();
    }
  });

  it("should read all todos", async () => {
    const todos = await getAllTodos();
    expect(todos).toEqual([]);
  });

  it("should create a todo", async () => {
    const message = await createTodo(title, id);
    expect(message).toEqual("Write succeeded");
    const todos = await getAllTodos();
    expect(todos[0].title).toEqual(title);
  });

  it("should read one todo by id", async () => {
    const todo = await getTodoById(id);
    expect(todo.title).toEqual(title);
  });

  it("should edit a todo", async () => {
    const newTitle = "build a todo app";
    const message = await editTodoById(id, newTitle);
    expect(message).toEqual("Write succeeded");
    const t = await getTodoById(id);
    expect(t.title).toEqual(newTitle);
  });

  it("should complete a todo", async () => {
    const message = await toggleTodoStatusById(id);
    expect(message).toEqual("Write succeeded");
    const t = await getTodoById(id);
    expect(t.completed).toEqual(true);
  });

  it("should delete a todo", async () => {
    const message = await deleteTodoById(id);
    expect(message).toEqual("Write succeeded");
    const t = await getTodoById(id);
    expect(t.deleted).toEqual(true);
  });
});