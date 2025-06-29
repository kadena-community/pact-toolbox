export interface User {
  id: string;
  name: string;
}

export function getUser(id: string): User {
  return { id, name: "test" };
}

export function createUser(name: string): User {
  return { id: "123", name };
}