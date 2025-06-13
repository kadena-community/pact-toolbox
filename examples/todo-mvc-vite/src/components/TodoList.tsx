"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { deleteTodoById, editTodoById, getAllTodos, toggleTodoStatusById } from "../api/api";

import "./TodoList.css";

import TodoAddForm from "./TodoAddForm";
import { TodoItem } from "./TodoItem";

interface TodoMutationParams {
  id: string;
  title: string;
}
export function TodoList() {
  const queryClient = useQueryClient();
  const {
    data: todos = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["todos/readTodos"],
    queryFn: getAllTodos,
  });

  const toggleMutation = useMutation({
    mutationKey: ["todos/togleTodo"],
    mutationFn: toggleTodoStatusById,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["todos/readTodos"],
      });
    },
  });

  const updateMutation = useMutation({
    mutationKey: ["todos/updateTodo"],
    mutationFn: ({ id, title }: TodoMutationParams) => editTodoById(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["todos/readTodos"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationKey: ["todos/deleteTodo"],
    mutationFn: deleteTodoById,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["todos/readTodos"],
      });
    },
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    toggleMutation.mutate(id);
  };

  const handleUpdate = (id: string, title: string) => {
    updateMutation.mutate({ id, title });
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this todo?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="todo-list-container">
        <h1>Todo List</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="todo-list-container">
        <h1>Todo List</h1>
        <p>Error: {error instanceof Error ? error.message : "An error occurred."}</p>
      </div>
    );
  }
  return (
    <div className="todo-list-container">
      <h1>Todo List</h1>
      <TodoAddForm />
      {todos.length > 0 ? (
        <ul className="todo-list">
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              isEditing={editingId === todo.id}
              onToggle={() => handleToggle(todo.id)}
              onEdit={() => setEditingId(todo.id)}
              onUpdate={handleUpdate}
              onDelete={() => handleDelete(todo.id)}
              onCancel={handleCancel}
            />
          ))}
        </ul>
      ) : (
        <p>No todos</p>
      )}
    </div>
  );
}