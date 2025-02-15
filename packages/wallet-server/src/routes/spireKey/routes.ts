import type { Router } from "h3";
import { defineEventHandler, getQuery } from "h3";
import open from "open";

export const SPIRE_KEY_URL = "https://spirekey.kadena.io";
const port = 8080;

const startAuthHandler = defineEventHandler(async (event) => {
  // Construct the OAuth URL here. Adjust the parameters as necessary.
  const clientId = "YOUR_CLIENT";
  const redirectUri = `http://localhost:${port}/spireKey/callback`;
  const authUrl = `${SPIRE_KEY_URL}/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
  await open(authUrl);
  return { status: 200, body: "Authentication process has started in your browser." };
});

const callbackHandler = defineEventHandler(async (event) => {
  const query = getQuery(event);
  console.log("OAuth token:", query);
  return { status: 200, body: "Authentication successful! You can close this window." };
});

export function setupSpireKeyRoutes(router: Router): void {
  router.get("/spireKey/startAuth", startAuthHandler);
  router.get("/spireKey/callback", callbackHandler);
}
