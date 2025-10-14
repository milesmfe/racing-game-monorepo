import { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";
import type { WSMessage, Player } from "@racing-game-mono/core";
import { serve } from "@hono/node-server";

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

const players = new Map<string, Player>();

app.get("/", (c) => {
  return c.text("Racing Game Server");
});

const ws = app.get(
  "/ws",
  upgradeWebSocket((c) => {
    return {
      onMessage(event, ws) {
        const message = JSON.parse(event.data.toString()) as WSMessage;
        // Handle game logic here
        console.log("Received:", message);
      },
      onClose() {
        console.log("Connection closed");
      },
    };
  })
);

const server = serve({
  fetch: app.fetch,
  port: 3000,
});

injectWebSocket(server);

console.log("Server running on http://localhost:3000");
