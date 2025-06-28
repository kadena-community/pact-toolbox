"use client";

import { useQuery } from "@tanstack/react-query";
import { getTodos } from "~/api/api";
import { TodoItem } from "./TodoItem";
import { TodoAddForm } from "./TodoAddForm";

export function TodoList() {
  const { data: todos = [], isLoading, error } = useQuery({
    queryKey: ["todos"],
    queryFn: getTodos,
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-gray-600">Loading todos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Error loading todos: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <TodoAddForm />
      
      {todos.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          No todos yet. Create one above!
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {todos.map((todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </ul>
      )}
      
      {todos.length > 0 && (
        <div className="mt-6 text-sm text-gray-600 text-center">
          {todos.filter(t => t.completed).length} of {todos.length} completed
        </div>
      )}
    </div>
  );
}