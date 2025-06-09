import { getUuid } from "@pact-toolbox/client";

// importing from pact files
import * as todosContract from "~/pact/todos.pact";

export async function getAllTodos() {
  return todosContract.getTodos().build().dirtyRead();
}

export async function getTodoById(id: string) {
  return todosContract.getTodo(id).build().dirtyRead();
}

export async function editTodoById(id: string, title: string) {
  return todosContract.updateTodo(id, title).sign().submitAndListen();
}

export async function toggleTodoStatusById(id: string) {
  return todosContract.toggleTodo(id).sign().submitAndListen();
}

export async function deleteTodoById(id: string) {
  return todosContract.deleteTodo(id).sign().submitAndListen();
}

export async function createTodo(title: string, id: string = getUuid()) {
  return todosContract.createTodo(id, title).sign().submitAndListen();
}
