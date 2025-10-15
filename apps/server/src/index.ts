import { Hono } from "hono";
import { cors } from "hono/cors";
import { createNodeWebSocket } from "@hono/node-ws";
import type { WSMessage, Player } from "@racing-game-mono/core";
import { serve } from "@hono/node-server";
import "dotenv/config";

// -------------------------------------------------------------------------------------------
// Hono Setup
// -------------------------------------------------------------------------------------------
const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:5173",
];

app.use(
  "/*",
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);

// -------------------------------------------------------------------------------------------
// API
// -------------------------------------------------------------------------------------------
app.get("/", (c) => {
  return c.text("Racing Game Server");
});

// -------------------------------------------------------------------------------------------
// WebSocket
// -------------------------------------------------------------------------------------------
const ws = app.get(
  "/ws",
  upgradeWebSocket((c) => {
    return {
      onMessage(event, ws) {
        const message = JSON.parse(event.data.toString()) as WSMessage;
        console.log("Received:", message);
      },
      onClose() {
        console.log("Connection closed");
      },
    };
  })
);

// -------------------------------------------------------------------------------------------
// Start server
// -------------------------------------------------------------------------------------------
const server = serve({
  fetch: app.fetch,
  port: Number(PORT),
});

injectWebSocket(server);

console.log(`Racing Game Server running on http://localhost:${PORT}`);
console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
console.log(`API endpoint: http://localhost:${PORT}/api`);
