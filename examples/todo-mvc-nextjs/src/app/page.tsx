import { TodoList } from "~/components/TodoList";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Todo MVC with Pact
        </h1>
        <div className="max-w-2xl mx-auto">
          <TodoList />
        </div>
      </div>
    </main>
  );
}