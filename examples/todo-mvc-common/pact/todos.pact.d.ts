// This file was generated by the Pact Toolbox
import { PactTransactionBuilder, PactExecPayload } from "@pact-toolbox/client";
/**
 * Row type for todos table
 */
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  deleted: boolean;
}
/**
 * Create new todo with ENTRY and DATE.
 */
export declare function newTodo(id: string, title: string): PactTransactionBuilder<PactExecPayload, string>;
/**
 * Toggle completed status flag for todo at ID.
 */
export declare function toggleTodoStatus(id: string): PactTransactionBuilder<PactExecPayload, unknown>;
/**
 * Update todo ENTRY at ID.
 */
export declare function editTodo(id: string, title: string): PactTransactionBuilder<PactExecPayload, unknown>;
/**
 * Delete todo title at ID (by setting deleted flag).
 */
export declare function deleteTodo(id: string): PactTransactionBuilder<PactExecPayload, unknown>;
/**
 * Read a single todo
 */
export declare function readTodo(id: string): PactTransactionBuilder<PactExecPayload, Todo>;
/**
 * Read all todos.
 */
export declare function readTodos(): PactTransactionBuilder<PactExecPayload, Todo[]>;
