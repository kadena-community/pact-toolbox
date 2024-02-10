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
  detentionUrl: string;
  onDemandUrl?: string;
}
export async function createProxyServer({
  detentionUrl = 'http://localhost:8080',
  port,
  onDemandUrl,
}: ProxyServerOptions): Promise<ProxyServer> {
  const app = createApp();
  let listener: Listener;
  const isOnDemand = !!onDemandUrl;
  if (onDemandUrl) {
    app.use(
      '/make-blocks',
      eventHandler((event) => {
        return proxyRequest(event, `${onDemandUrl}/make-blocks`);
      }),
    );
  }

  const start = async () => {
    app.use(
      '*',
      eventHandler(async (event) => {
        const path = event.req.url;
        if (isOnDemand && path?.endsWith('/listen')) {
          await makeBlocks({
            count: 1,
            onDemandUrl,
          });
        }
        return proxyRequest(event, `${detentionUrl}${path}`);
      }),
    );
    try {
      listener = await listen(toNodeListener(app), { port, isProd: true, showURL: false });
    } catch (e) {
      logger.fatal('Failed to start proxy server');
      process.exit(1);
    }
    return listener;
  };

  const stop = async () => listener.close();
  return {
    app,
    start,
    stop,
  };
}
