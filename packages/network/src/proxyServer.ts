import { logger } from '@pact-toolbox/utils';
import { App, createApp, eventHandler, proxyRequest, toNodeListener } from 'h3';
import { Listener, listen } from 'listhen';
import { makeBlocks } from './utils';

export interface ProxyServer {
  app: App;
  start: () => Promise<Listener>;
  stop: () => Promise<void>;
}

interface ProxyServerOptions {
  port: number | string;
  url: string;
  isOnDemand?: boolean;
}
export async function createProxyServer({
  url = 'http://localhost:8080',
  port,
  isOnDemand,
}: ProxyServerOptions): Promise<ProxyServer> {
  const app = createApp();
  app.use(
    '*',
    eventHandler(async (event) => {
      if (isOnDemand && event.req.url?.includes('listen')) {
        await makeBlocks({
          count: 5,
          port,
        });
      }
      return proxyRequest(event, `${url}/${event.req.url}`);
    }),
  );

  let listener: Listener;
  const start = async () => {
    try {
      listener = await listen(toNodeListener(app), { port, isProd: true, showURL: false });
    } catch (e) {
      logger.fatal('Failed to start proxy server');
      process.exit(1);
    }
    return listener;
  };

  const stop = async () => {
    await listener.close();
  };

  return {
    app,
    start,
    stop,
  };
}
