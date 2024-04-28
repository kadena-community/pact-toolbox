import { execAsync } from '@pact-toolbox/utils';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

// Checks if the line contains the "I AM NOT DONE" comment.
function containsNotDoneComment(input: string): boolean {
  const regex = /\/\/+.*I AM NOT DONE/i;
  return regex.test(input);
}

interface ExerciseData {
  name: string;
  path: string;
  mode: 'repl' | 'module';
  hint: string;
}

export class Exercise {
  constructor(private data: ExerciseData) {}

  async getCode() {
    if (!existsSync(this.data.path)) {
      throw new Error(`File not found: ${this.data.path}`);
    }
    const code = readFile(this.data.path, 'utf-8');
    return code;
  }

  async run() {
    await execAsync(`pact ${this.data.path}`);
  }

  async isDone() {
    const code = await this.getCode();
    return !containsNotDoneComment(code);
  }
}
