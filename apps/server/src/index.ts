import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { handleConnection } from "@racing-game-mono/server/network/WebSocketHandler.js";
import type { Context } from "hono";
import { WebSocket } from "ws";

const PORT = 8080;

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Basic REST endpoint for health checks
app.get("/", (c: Context) => {
  return c.text("Game Server is running.");
});

// Define the WebSocket upgrade route
app.get(
  "/ws",
  upgradeWebSocket((c: Context) => {
    return {
      onOpen(event, ws) {
        console.log("Client connected.");
        handleConnection(ws.raw as WebSocket);
      },
      onClose: () => {
        // Note: The 'close' logic is handled within GameState to ensure
        // the player is properly removed from the game instance.
        console.log("Connection closed");
      },
      onError(event, ws) {
        console.error("WebSocket error:", event);
      },
    };
  })
);

console.log(`Server is listening on port ${PORT}`);

const server = serve({
  fetch: app.fetch,
  port: PORT,
});

injectWebSocket(server);
