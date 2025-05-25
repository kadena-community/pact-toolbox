import { randomUUID } from "uncrypto";

export function getUuid(): string {
  return randomUUID();
}
