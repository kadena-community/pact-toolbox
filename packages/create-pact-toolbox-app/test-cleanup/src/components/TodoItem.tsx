"use client";

import { TodoEditForm } from "./TodoEditForm";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodoItemProps {
  todo: Todo;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onUpdate: (id: string, title: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function TodoItem({ todo, isEditing, onToggle, onEdit, onUpdate, onCancel, onDelete }: TodoItemProps) {
  return (
    <li className={`todo-item ${todo.completed ? "completed" : ""}`}>
      <div className="todo-content">
        {isEditing ? (
          <TodoEditForm initialTitle={todo.title} onSave={(title) => onUpdate(todo.id, title)} onCancel={onCancel} />
        ) : (
          <label className="todo-title">
            <input type="checkbox" checked={todo.completed} onChange={onToggle} className="todo-checkbox" />
            {todo.title}
          </label>
        )}
      </div>
      {!isEditing && (
        <div className="action-buttons">
          <button onClick={onEdit} className="edit-button">
            Edit
          </button>
          <button onClick={onDelete} className="delete-button">
            Delete
          </button>
        </div>
      )}
    </li>
  );
}