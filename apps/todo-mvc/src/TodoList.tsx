import { useQuery } from '@tanstack/react-query';
import { readTodos } from './api';

export function TodoList() {
  const { data: todos = [] } = useQuery({
    queryKey: ['todos/readTodos'],
    queryFn: readTodos,
  });

  return (
    <div>
      {todos.length > 0 ? (
        todos.map((todo) => (
          <div key={todo.id}>
            <h2>{todo.title}</h2>
            <p>{todo.completed}</p>
          </div>
        ))
      ) : (
        <p>No todos</p>
      )}
    </div>
  );
}
