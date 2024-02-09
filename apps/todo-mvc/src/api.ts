import { Pact } from '@kadena/client';
import {
  addDefaultMeta,
  createClientUtils,
  createKadenaClient,
  createSignWithPactToolbox,
  generateUUID,
  getSignerAccount,
} from '@pact-toolbox/client-utils';

const client = createKadenaClient();
const sign = createSignWithPactToolbox();
const signer = getSignerAccount();

const { dirtyReadOrFail, submitAndListen } = createClientUtils(client);
export interface Todo {
  title: string;
  completed: boolean;
  deleted: boolean;
  id: string;
}
export async function readTodos() {
  const tx = addDefaultMeta(Pact.builder.execution(`(free.todos.read-todos)`)).createTransaction();
  return dirtyReadOrFail<Todo[]>(tx);
}

export async function readTodoById(id: string) {
  const tx = addDefaultMeta(Pact.builder.execution(`(free.todos.read-todo "${id}")`)).createTransaction();
  return dirtyReadOrFail<Todo>(tx);
}

export async function editTodoById(id: string, title: string) {
  const tx = addDefaultMeta(Pact.builder.execution(`(free.todos.edit-todo "${id}" "${title}")`))
    .addSigner(signer.publicKey)
    .setMeta({
      senderAccount: signer.account,
    })
    .createTransaction();
  const signedTX = await sign(tx);
  return submitAndListen(signedTX);
}

export async function toggleTodoStatusById(id: string) {
  const tx = addDefaultMeta(Pact.builder.execution(`(free.todos.toggle-todo-status "${id}")`))
    .addSigner(signer.publicKey)
    .setMeta({
      senderAccount: signer.account,
    })
    .createTransaction();
  const signedTX = await sign(tx);
  return submitAndListen(signedTX);
}

export async function deleteTodoById(id: string) {
  const tx = addDefaultMeta(Pact.builder.execution(`(free.todos.delete-todo "${id}")`))
    .addSigner(signer.publicKey)
    .setMeta({
      senderAccount: signer.account,
    })
    .createTransaction();
  const signedTX = await sign(tx);
  return submitAndListen(signedTX);
}

export async function createTodo(title: string, id: string = generateUUID()) {
  const tx = addDefaultMeta(Pact.builder.execution(`(free.todos.new-todo "${id}" "${title}")`))
    .addSigner(signer.publicKey, (signFor) => [signFor('coin.GAS')])
    .setMeta({
      senderAccount: signer.account,
    })
    .createTransaction();
  const signedTX = await sign(tx);
  return submitAndListen(signedTX);
}
