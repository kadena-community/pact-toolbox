import { Pact } from '@kadena/client';
import { addDefaultMeta, createKadenaClient, createKdaClientHelpers, getUuid } from '@pact-toolbox/client-utils';
import { ToolboxWalletProvider } from '@pact-toolbox/wallet';

const getClient = createKadenaClient();
const wallet = new ToolboxWalletProvider();
// const wallet = new EckoWalletProvider();
const { dirtyReadOrFail, submitAndListen } = createKdaClientHelpers(getClient);
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
  const signer = await wallet.getSigner();
  const tx = addDefaultMeta(Pact.builder.execution(`(free.todos.edit-todo "${id}" "${title}")`))
    .addSigner(signer.publicKey)
    .setMeta({
      senderAccount: signer.address,
    })
    .createTransaction();
  const signedTX = await wallet.sign(tx);
  return submitAndListen(signedTX);
}

export async function toggleTodoStatusById(id: string) {
  const signer = await wallet.getSigner();
  const tx = addDefaultMeta(Pact.builder.execution(`(free.todos.toggle-todo-status "${id}")`))
    .addSigner(signer.publicKey)
    .setMeta({
      senderAccount: signer.address,
    })
    .createTransaction();
  const signedTX = await wallet.sign(tx);
  return submitAndListen(signedTX);
}

export async function deleteTodoById(id: string) {
  const signer = await wallet.getSigner();
  const tx = addDefaultMeta(Pact.builder.execution(`(free.todos.delete-todo "${id}")`))
    .addSigner(signer.publicKey)
    .setMeta({
      senderAccount: signer.address,
    })
    .createTransaction();
  const signedTX = await wallet.sign(tx);
  return submitAndListen(signedTX);
}

export async function createTodo(title: string, id: string = getUuid()) {
  const signer = await wallet.getSigner();
  const tx = addDefaultMeta(Pact.builder.execution(`(free.todos.new-todo "${id}" "${title}")`))
    .addSigner(signer.publicKey, (signFor) => [signFor('coin.GAS')])
    .setMeta({
      senderAccount: signer.address,
    })
    .createTransaction();
  const signedTX = await wallet.sign(tx);
  return submitAndListen(signedTX);
}
