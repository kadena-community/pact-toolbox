import { join } from 'node:path';
import { PactConfig } from '../config';

export async function resolvePreludes(config: PactConfig) {
  const preludesDir = join(process.cwd(), config.contractsDir as string, 'prelude');
  const uniquePreludes = [...new Set(config.preludes)];

  const preludes = await Promise.all(
    uniquePreludes?.map((prelude) => {
      if (typeof prelude === 'string') {
        switch (prelude) {
          case 'kadena/chainweb':
            return import('../preludes/kadena/chainweb').then((m) => m.default);
          default:
            throw new Error(`Prelude ${prelude} not found`);
        }
      }
      return prelude;
    }) ?? [],
  );

  return { preludes, preludesDir };
}
