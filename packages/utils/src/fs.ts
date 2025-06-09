import { mkdir, writeFile as _writeFile, access } from "node:fs/promises";
import { dirname } from "pathe";

export async function ensureDir(dirPath: string): Promise<void> {
  if (!(await access(dirPath).catch(() => false))) {
    await mkdir(dirPath, { recursive: true });
  }
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath));
  await _writeFile(filePath, content.trim());
}
