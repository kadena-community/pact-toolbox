"use client";

import React, { useEffect, useRef, useState } from "react";

interface TodoEditFormProps {
  initialTitle: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}

export function TodoEditForm({ initialTitle, onSave, onCancel }: TodoEditFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(title.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="edit-form">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => onSave(title)}
        className="edit-input"
      />
      <div className="edit-buttons">
        <button type="button" onClick={onCancel} className="cancel-button">
          Cancel
        </button>
        <button type="submit" className="save-button">
          Save
        </button>
      </div>
    </form>
  );
}