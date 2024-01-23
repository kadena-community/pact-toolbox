import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PactTestEnv, setupPactTestEnv } from '../src/pact/setupTestEnv';
describe('hello world', () => {
  let env: PactTestEnv;
  beforeAll(async () => {
    env = await setupPactTestEnv();
    await env.client.deployContract('hello-world.pact');
  });

  afterAll(() => {
    env.stop();
  });
  it('should say hello', async () => {
    const signer = env.client.getSigner();
    const tx = env.client
      .execution('(free.hello-world.say-hello "Salama")')
      .addSigner(signer.publicKey)
      .createTransaction();
    const signedTX = await env.client.sign(tx);
    const s = await env.client.submitAndListen(signedTX);
    expect(s, 'Hello, Salama!');
  });
});
