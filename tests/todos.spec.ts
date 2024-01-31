import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PactTestEnv, setupPactTestEnv } from '../src/pact/setupTestEnv';

interface Todo {
  id: string;
  deleted: boolean;
  completed: boolean;
  title: string;
}
describe('todos', () => {
  let env: PactTestEnv;
  beforeAll(async () => {
    env = await setupPactTestEnv();
    await env.client.deployContract('todos.pact');
  });

  afterAll(() => {
    env?.stop();
  });
  it('should read all todos', async () => {
    const signer = env.client.getSigner();
    const tx = env.client.execution('(free.todos.read-todos)').addSigner(signer.publicKey).createTransaction();
    const signedTX = await env.client.sign(tx);
    const s = await env.client.dirtyRead(signedTX);
    expect(s).toEqual([]);
  });

  it('should create a todo', async () => {
    const signer = env.client.getSigner();
    const tx = env.client
      .execution(`(free.todos.new-todo "1" "Learn pact")`)
      .addSigner(signer.publicKey)
      .createTransaction();
    const signedTX = await env.client.sign(tx);
    const s = await env.client.submitAndListen(signedTX);
    expect(s).toEqual('Write succeeded');

    // await new Promise((resolve) => setTimeout(() => resolve(null), 1000));
    const tx2 = env.client.execution('(free.todos.read-todos)').addSigner(signer.publicKey).createTransaction();

    const signedTX2 = await env.client.sign(tx2);
    const s2 = await env.client.dirtyRead(signedTX2);
    expect(s2).toEqual([
      {
        id: '1',
        deleted: false,
        completed: false,
        title: 'Learn pact',
      },
    ]);
  });

  it('should read one todo by id', async () => {
    const signer = env.client.getSigner();
    const tx = env.client.execution('(free.todos.read-todo "1")').addSigner(signer.publicKey).createTransaction();
    const signedTX = await env.client.sign(tx);
    const t = await env.client.submitAndListen<Todo>(signedTX);
    expect(t.title).toEqual('Learn pact');
  });

  it('should edit a todo', async () => {
    const signer = env.client.getSigner();
    const tx = env.client
      .execution(`(free.todos.edit-todo "1" "build a todo app")`)
      .addSigner(signer.publicKey)
      .createTransaction();
    const signedTX = await env.client.sign(tx);
    const s = await env.client.submitAndListen(signedTX);
    expect(s).toEqual('Write succeeded');

    const tx2 = env.client.execution('(free.todos.read-todo "1")').addSigner(signer.publicKey).createTransaction();
    const signedTX2 = await env.client.sign(tx2);
    const t = await env.client.submitAndListen<Todo>(signedTX2);
    expect(t.title).toEqual('build a todo app');
  });

  it('should complete a todo', async () => {
    const signer = env.client.getSigner();
    const tx = env.client
      .execution(`(free.todos.toggle-todo-status "1")`)
      .addSigner(signer.publicKey)
      .createTransaction();
    const signedTX = await env.client.sign(tx);
    const s = await env.client.submitAndListen(signedTX);
    expect(s).toEqual('Write succeeded');

    const tx2 = env.client.execution('(free.todos.read-todo "1")').addSigner(signer.publicKey).createTransaction();
    const signedTX2 = await env.client.sign(tx2);
    const t = await env.client.submitAndListen<Todo>(signedTX2);
    expect(t.completed).toEqual(true);
  });

  it('should delete a todo', async () => {
    const signer = env.client.getSigner();
    const tx = env.client.execution(`(free.todos.delete-todo "1")`).addSigner(signer.publicKey).createTransaction();
    const signedTX = await env.client.sign(tx);
    const s = await env.client.submitAndListen(signedTX);
    expect(s).toEqual('Write succeeded');

    const tx2 = env.client.execution('(free.todos.read-todo "1")').addSigner(signer.publicKey).createTransaction();
    const signedTX2 = await env.client.sign(tx2);
    const t = await env.client.submitAndListen<Todo>(signedTX2);
    expect(t.deleted).toEqual(true);
  });
});
