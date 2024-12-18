import type { Router } from "h3";

import { setupSigningRoutes } from "./signing/routes";
import { setupSpireKeyRoutes } from "./spireKey/routes";

export function setupRoutes(router: Router) {
  setupSigningRoutes(router);
  setupSpireKeyRoutes(router);
}
