import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PactTestEnv, setupPactTestEnv } from '../src/pact/setupTestEnv';
describe('hello world', () => {
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
    const tx = env.client.execution('(free.todos.read-all)').addSigner(signer.publicKey).createTransaction();
    const signedTX = await env.client.sign(tx);
    const s = await env.client.submitAndListen(signedTX);
    expect(s).toEqual(['Learn pact', 'Write your first contract']);
  });

  it('should create a todo', async () => {
    const signer = env.client.getSigner();
    const tx = env.client
      .execution('(free.todos.create "Learn vitest")')
      .addSigner(signer.publicKey)
      .createTransaction();
    const signedTX = await env.client.sign(tx);
    const s = await env.client.submitAndListen(signedTX);
    expect(s).toEqual('Learn vitest');
  });

  it('should read one todo by id', async () => {
    const signer = env.client.getSigner();
    const tx = env.client.execution('(free.todos.read 1)').addSigner(signer.publicKey).createTransaction();
    const signedTX = await env.client.sign(tx);
    const s = await env.client.submitAndListen(signedTX);
    expect(s).toEqual('Learn vitest');
  });
});
