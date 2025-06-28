"use client";

import { useState, useEffect, useRef } from "react";

interface TodoEditFormProps {
  initialTitle: string;
  onSave: (title: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TodoEditForm({ initialTitle, onSave, onCancel, isLoading }: TodoEditFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && title !== initialTitle) {
      onSave(title.trim());
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 bg-gray-50 rounded">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {isLoading ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={isLoading}
        className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
      >
        Cancel
      </button>
    </form>
  );
}