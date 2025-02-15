import type { ListenOptions } from "listhen";
import { createApp, createRouter, toNodeListener } from "h3";
import { listen } from "listhen";

import { setupRoutes } from "./routes";

interface WalletServerOptions extends Partial<ListenOptions> {
  port?: number;
}
export async function startWalletServer(options: WalletServerOptions) {
  const app = createApp();
  const router = createRouter();
  // setup routes
  setupRoutes(router);
  app.use(router);
  try {
    await listen(toNodeListener(app), {
      isProd: true,
      showURL: false,
      ...options,
      port: options.port ?? 8080,
    });
  } catch (e) {
    throw new Error("Failed to start proxy server");
  }
}
