import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TodoInput } from './TodoInput';
import { TodoList } from './TodoList';
import { createTodo } from './api';

function App() {
  const queryClient = useQueryClient();
  const { mutateAsync: addTodo } = useMutation({
    mutationKey: ['todos/createTodo'],
    mutationFn: createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['todos/readTodos'],
      });
    },
  });

  return (
    <div>
      <TodoInput addTodo={addTodo} />
      <TodoList />
    </div>
  );
}

export default App;
