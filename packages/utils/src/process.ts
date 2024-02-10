import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

export interface RunBinOptions {
  silent?: boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  resolveIf?: (data: string) => boolean;
}
export function runBin(
  bin: string,
  args: string[],
  { cwd = process.cwd(), silent = false, env = process.env, resolveIf = () => true }: RunBinOptions,
): Promise<ChildProcessWithoutNullStreams> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { cwd, env });
    proc.stdout.on('data', (data) => {
      const s = data.toString();
      if (resolveIf(s)) {
        resolve(proc);
      }
      if (!silent) {
        console.log(s);
      }
    });

    proc.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    proc.on('error', (err) => {
      reject(err);
    });

    process.on('exit', () => {
      proc.kill();
    });

    process.on('SIGINT', () => {
      proc.kill('SIGINT');
    });
  });
}
