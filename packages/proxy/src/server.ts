import type { Router } from 'h3';
import { createApp, createRouter, toNodeListener } from 'h3';
import type { ListenOptions, Listener } from 'listhen';
import { listen } from 'listhen';
import { setupRoutes, setupWildCardProxy } from './routes';
import type { PactToolboxNetworkApiLike } from './types';

export interface CreateDevProxyServerOptions extends Partial<ListenOptions> {
  port?: number | string;
}

export class PactToolboxDevProxyServer {
  private app = createApp();
  private router = createRouter();
  private listener?: Listener;

  constructor(
    private network: PactToolboxNetworkApiLike,
    private options: CreateDevProxyServerOptions,
  ) {
    setupRoutes(this.router, network);
  }

  addRoute(setup: (router: Router) => void) {
    if (this.listener) {
      throw new Error('Cannot add routes after server has started');
    }
    setup(this.router);
  }

  async start() {
    this.app.use(this.router);
    setupWildCardProxy(this.app, this.network);
    try {
      this.listener = await listen(toNodeListener(this.app), {
        isProd: true,
        showURL: false,
        ...this.options,
        port: this.options.port ?? 8080,
      });
    } catch (e) {
      throw new Error('Failed to start proxy server');
    }
    return this.listener;
  }

  async stop() {
    await this.listener?.close();
  }
}

export function createDevProxyServer(network: PactToolboxNetworkApiLike, options: CreateDevProxyServerOptions) {
  return new PactToolboxDevProxyServer(network, options);
}
