import { useQuery } from "@tanstack/react-query";

export function Hello() {
  const { data: message } = useQuery({
    queryKey: ["hello-world/say-hello"],
    queryFn: async () => {
      return "Hello, World!";
    },
  });

  return (
    <div>
      <button>Say Hello</button>
      <div>{message}</div>
    </div>
  );
}
