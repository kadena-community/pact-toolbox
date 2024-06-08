import type { App, Router } from "h3";
import { eventHandler } from "h3";

import type { PactToolboxNetworkApiLike } from "./types";

export function setupRoutes(router: Router, networkApi: PactToolboxNetworkApiLike) {
  // if (networkApi.hasOnDemandMining()) {
  //   router.post(
  //     '/make-blocks',
  //     eventHandler((event) => {
  //       return proxyRequest(event, `${networkApi.getOnDemandUrl()}/make-blocks`);
  //     }),
  //   );
  // }
  router.post(
    "/pact-toolbox/restart",
    eventHandler(async () => {
      await networkApi.restart();
      return { status: "ok" };
    }),
  );
}

export function setupWildCardProxy(_app: App, _networkApi: PactToolboxNetworkApiLike) {
  // app.use(
  //   '*',
  //   eventHandler(async (event) => {
  //     const path = event.req.url;
  //     if (networkApi.hasOnDemandMining() && path?.endsWith('/listen')) {
  //       await makeBlocks({
  //         count: 5,
  //         onDemandUrl: networkApi.getOnDemandUrl(),
  //       });
  //     }
  //     return proxyRequest(event, `${networkApi.getServiceUrl()}${path}`);
  //   }),
  // );
}
