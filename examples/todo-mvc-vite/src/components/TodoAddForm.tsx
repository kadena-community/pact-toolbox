"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { createTodo } from "../api/api";

const TodoAddForm: React.FC = () => {
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();

  const addTodoMutation = useMutation({
    mutationKey: ["todos/createTodo"],
    mutationFn: createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["todos/readTodos"],
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      addTodoMutation.mutate(title.trim());
      setTitle("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-form">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a new todo..."
        className="add-input"
      />
      <button type="submit" className="add-button" disabled={addTodoMutation.isPending}>
        {addTodoMutation.isPending ? "Adding..." : "Add"}
      </button>
    </form>
  );
};

export default TodoAddForm;
