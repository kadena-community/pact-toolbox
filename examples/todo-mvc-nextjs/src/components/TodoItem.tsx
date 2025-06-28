"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toggleTodo, deleteTodo, updateTodo, type Todo } from "~/api/api";
import { TodoEditForm } from "./TodoEditForm";

interface TodoItemProps {
  todo: Todo;
}

export function TodoItem({ todo }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: () => toggleTodo(todo.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTodo(todo.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (title: string) => updateTodo(todo.id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      setIsEditing(false);
    },
  });

  if (isEditing) {
    return (
      <TodoEditForm
        initialTitle={todo.title}
        onSave={updateMutation.mutate}
        onCancel={() => setIsEditing(false)}
        isLoading={updateMutation.isPending}
      />
    );
  }

  return (
    <li className="flex items-center gap-3 p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => toggleMutation.mutate()}
        disabled={toggleMutation.isPending}
        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
      />
      
      <span
        className={`flex-1 ${
          todo.completed ? "line-through text-gray-500" : "text-gray-800"
        }`}
        onDoubleClick={() => setIsEditing(true)}
      >
        {todo.title}
      </span>
      
      <button
        onClick={() => setIsEditing(true)}
        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
      >
        Edit
      </button>
      
      <button
        onClick={() => deleteMutation.mutate()}
        disabled={deleteMutation.isPending}
        className="px-3 py-1 text-sm text-red-600 hover:text-red-800 focus:outline-none disabled:opacity-50"
      >
        Delete
      </button>
    </li>
  );
}