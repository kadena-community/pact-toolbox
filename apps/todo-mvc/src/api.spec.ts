import { generateUUID } from '@pact-toolbox/client-utils';
import { PactTestEnv, setupPactTestEnv } from '@pact-toolbox/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTodo, deleteTodoById, editTodoById, readTodoById, readTodos, toggleTodoStatusById } from './api';

describe('todos api', () => {
  let env: PactTestEnv;
  let id = generateUUID();
  let title = 'Learn pact';

  beforeAll(async () => {
    env = await setupPactTestEnv('local');
    await env.client.deployContract('todos.pact');
  });

  afterAll(() => {
    env?.stop();
  });
  it('should read all todos', async () => {
    const todos = await readTodos();
    expect(todos).toEqual([]);
  });

  it('should create a todo', async () => {
    const message = await createTodo(title, id);
    expect(message).toEqual('Write succeeded');
    const todos = await readTodos();
    expect(todos[0].title).toEqual(title);
  });

  it('should read one todo by id', async () => {
    const todo = await readTodoById(id);
    expect(todo.title).toEqual(title);
  });

  it('should edit a todo', async () => {
    const newTitle = 'build a todo app';
    const message = await editTodoById(id, newTitle);
    expect(message).toEqual('Write succeeded');
    const t = await readTodoById(id);
    expect(t.title).toEqual(newTitle);
  });

  it('should complete a todo', async () => {
    const message = await toggleTodoStatusById(id);
    expect(message).toEqual('Write succeeded');
    const t = await readTodoById(id);
    expect(t.completed).toEqual(true);
  });

  it('should delete a todo', async () => {
    const message = await deleteTodoById(id);
    expect(message).toEqual('Write succeeded');
    const t = await readTodoById(id);
    expect(t.deleted).toEqual(true);
  });
});