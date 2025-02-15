import http, { Server } from "http";
import { createApp, createRouter, toNodeListener } from "h3";

import { setupRoutes } from "./routes";

const app = createApp();
// Create a router instance
const router = createRouter();

// Function to start the server
export function startServer(port: number = 9467, setup = setupRoutes): Promise<Server> {
  setup(router);
  // Attach the router to the app
  app.use(router);
  return new Promise((resolve, reject) => {
    const server = http.createServer(toNodeListener(app));
    server.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}/`);
      resolve(server);
    });
    server.on("error", (err) => {
      reject(err);
    });
  });
}

// Function to stop the server
export function stopServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
