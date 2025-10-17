import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import "dotenv/config";

import type { WSMessage, Player } from "@racing-game-mono/core";

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
app.get("/api/health", (c) => {
  return c.json({ status: "ok", environment: NODE_ENV });
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
// Server frontend in production mode
// -------------------------------------------------------------------------------------------
if (NODE_ENV === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const getContentType = (path: string): string => {
    if (path.endsWith(".js")) return "application/javascript";
    if (path.endsWith(".css")) return "text/css";
    if (path.endsWith(".html")) return "text/html";
    if (path.endsWith(".json")) return "application/json";
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
    if (path.endsWith(".svg")) return "image/svg+xml";
    if (path.endsWith(".woff")) return "font/woff";
    if (path.endsWith(".woff2")) return "font/woff2";
    if (path.endsWith(".ttf")) return "font/ttf";
    return "application/octet-stream";
  };

  // Serve static files for the main web app
  app.get("/", async (c) => {
    try {
      const indexHtml = await readFile(
        join(__dirname, "web/dist/index.html"),
        "utf-8"
      );
      return c.html(indexHtml);
    } catch (error) {
      return c.text("Main app not found", 404);
    }
  });

  // Serve static assets for the main web app
  app.get("/assets/*", async (c) => {
    try {
      const path = c.req.path.replace("/assets/", "");
      const buffer = await readFile(join(__dirname, "web/dist/assets", path));
      const uint8Array = new Uint8Array(buffer);
      const contentType = getContentType(path);
      return c.body(uint8Array, 200, { "Content-Type": contentType });
    } catch (error) {
      return c.text("Asset not found", 404);
    }
  });

  // Serve static files for the track designer app
  app.get("/track-designer", async (c) => {
    try {
      const indexHtml = await readFile(
        join(__dirname, "track-designer/dist/index.html"),
        "utf-8"
      );
      return c.html(indexHtml);
    } catch (error) {
      return c.text("Track designer app not found", 404);
    }
  });

  // Serve static assets for the track designer app
  app.get("/track-designer/assets/*", async (c) => {
    try {
      const path = c.req.path.replace("/track-designer/assets/", "");
      const buffer = await readFile(
        join(__dirname, "track-designer/dist/assets", path)
      );
      const uint8Array = new Uint8Array(buffer);
      const contentType = getContentType(path);
      return c.body(uint8Array, 200, { "Content-Type": contentType });
    } catch (error) {
      return c.text("Asset not found", 404);
    }
  });
} else {
  // In development, just return a simple message
  app.get("/", (c) => {
    return c.text(`Racing Game Server (${NODE_ENV}) is running.`);
  });
}

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
