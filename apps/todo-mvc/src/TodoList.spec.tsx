import { PactTestEnv, setupPactTestEnv } from '@pact-toolbox/test';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { TodoList } from './TodoList';
import { createTodo } from './api';
import { queryClient } from './queryClient';

function renderComponent() {
  return render(
    <QueryClientProvider client={queryClient}>
      <TodoList />
    </QueryClientProvider>,
  );
}
describe('TodoList', () => {
  let env: PactTestEnv;
  beforeAll(async () => {
    env = await setupPactTestEnv('local');
    await env.client.deployContract('todos.pact');
  });

  afterAll(() => {
    env?.stop();
  });

  it('should render an empty list', async () => {
    renderComponent();
    await screen.findByText('No todos');
  });

  it('should render a list of todos', async () => {
    await createTodo('Learn pact', '1');
    renderComponent();
    await screen.findByText('Learn pact');
  });
});
