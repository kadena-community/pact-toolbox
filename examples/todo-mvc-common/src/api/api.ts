import { getUuid } from "@pact-toolbox/client";

// importing from pact files
import { deleteTodo, editTodo, newTodo, readTodo, readTodos, toggleTodoStatus } from "../../pact/todos.pact";

export async function getAllTodos() {
  // new pact toolbox transaction interface
  return readTodos().build().dirtyRead();
}

export async function getTodoById(id: string) {
  return readTodo(id).build().dirtyRead();
}

export async function editTodoById(id: string, title: string) {
  return editTodo(id, title).sign().submitAndListen();
}

export async function toggleTodoStatusById(id: string) {
  return toggleTodoStatus(id).sign().submitAndListen();
}

export async function deleteTodoById(id: string) {
  return deleteTodo(id).sign().submitAndListen();
}

export async function createTodo(title: string, id: string = getUuid()) {
  return newTodo(id, title).sign().submitAndListen();
}
