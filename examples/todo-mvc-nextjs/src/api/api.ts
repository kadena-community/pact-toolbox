import { createPactToolboxClient } from "@pact-toolbox/transaction";
import type { TodosContract } from "~/pact/todos.pact";

const client = createPactToolboxClient();

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  deleted: boolean;
}

export async function getTodos(): Promise<Todo[]> {
  const result = await client
    .execution<TodosContract["get-todos"]>("free.todos.get-todos")
    .setData()
    .build()
    .dirtyRead();

  return result.result;
}

export async function getTodo(id: string): Promise<Todo> {
  const result = await client
    .execution<TodosContract["get-todo"]>("free.todos.get-todo")
    .setData(id)
    .build()
    .dirtyRead();

  return result.result;
}

export async function createTodo(title: string): Promise<string> {
  const result = await client
    .execution<TodosContract["create-todo"]>("free.todos.create-todo")
    .setData("todo-owner", title)
    .addSigner("todo-owner-keypair", [])
    .setMeta({ 
      chainId: "0", 
      sender: "todo-owner",
      gasLimit: 100000,
      gasPrice: 0.00000001,
      ttl: 600
    })
    .sign()
    .submitAndListen();

  return result.result;
}

export async function toggleTodo(id: string): Promise<string> {
  const result = await client
    .execution<TodosContract["toggle-todo"]>("free.todos.toggle-todo")
    .setData(id)
    .addSigner("todo-owner-keypair", [])
    .setMeta({ 
      chainId: "0", 
      sender: "todo-owner",
      gasLimit: 100000,
      gasPrice: 0.00000001,
      ttl: 600
    })
    .sign()
    .submitAndListen();

  return result.result;
}

export async function updateTodo(id: string, title: string): Promise<string> {
  const result = await client
    .execution<TodosContract["update-todo"]>("free.todos.update-todo")
    .setData(id, title)
    .addSigner("todo-owner-keypair", [])
    .setMeta({ 
      chainId: "0", 
      sender: "todo-owner",
      gasLimit: 100000,
      gasPrice: 0.00000001,
      ttl: 600
    })
    .sign()
    .submitAndListen();

  return result.result;
}

export async function deleteTodo(id: string): Promise<string> {
  const result = await client
    .execution<TodosContract["delete-todo"]>("free.todos.delete-todo")
    .setData(id)
    .addSigner("todo-owner-keypair", [])
    .setMeta({ 
      chainId: "0", 
      sender: "todo-owner",
      gasLimit: 100000,
      gasPrice: 0.00000001,
      ttl: 600
    })
    .sign()
    .submitAndListen();

  return result.result;
}