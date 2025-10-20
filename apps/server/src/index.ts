import { Hono } from "hono";
import { cors } from "hono/cors";
import { WSContext } from "hono/ws";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import "dotenv/config";

import {
  Id,
  WSConnectCommand,
  WSMessageTarget,
  createWSMessage,
  parseWSMessage,
  type WSMessage,
} from "@racing-game-mono/core";
import LobbyHandler from "./game/LobbyHandler";
import GameHandler from "./game/GameHandler";

// ----------------------------------------------------------------------------
// State & Connections
// ----------------------------------------------------------------------------
const connections = new Map<Id, WSContext>();
const clientIds = new WeakMap<WSContext, Id>();
const lobbyHandler = new LobbyHandler();
const gameHandler = new GameHandler();

// ----------------------------------------------------------------------------
// Hono Setup
// ----------------------------------------------------------------------------
const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

const PORT = process.env.PORT || 3000;
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS) || 100;

app.use("/*", cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || [] }));
app.get("/api/health", (c) => c.json({ status: "ok" }));

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------
const sendError = (ws: WSContext, message: string): void => {
  ws.send(JSON.stringify(createWSMessage.error(message)));
};

const handleClientMessage = async (
  clientId: Id,
  message: WSMessage,
  ws: WSContext
): Promise<void> => {
  switch (message.target) {
    case WSMessageTarget.LOBBY:
      await lobbyHandler.handleMessage(clientId, message, ws);
      break;
    case WSMessageTarget.GAME:
      await gameHandler.handleMessage(clientId, message, ws);
      break;
    case WSMessageTarget.CONNECT:
      console.warn(`Client ${clientId.value} sent a CONNECT target message.`);
      sendError(ws, "Connection messages are server-only.");
      break;
  }
};

// ----------------------------------------------------------------------------
// WebSocket
// ----------------------------------------------------------------------------
app.get(
  "/ws",
  upgradeWebSocket(() => {
    return {
      onOpen(_event, ws) {
        if (connections.size >= MAX_CONNECTIONS) {
          ws.close(1001, "Server full");
          return;
        }

        const clientId = new Id();
        connections.set(clientId, ws);
        clientIds.set(ws, clientId);
        console.log(
          `Client ${clientId.value} connected (${connections.size}/${MAX_CONNECTIONS})`
        );

        const welcome = createWSMessage.connect(WSConnectCommand.WELCOME, {
          clientId: clientId.value,
        });
        ws.send(JSON.stringify(welcome));
      },

      onMessage(event, ws) {
        const clientId = clientIds.get(ws);
        if (!clientId) return;

        let rawData: unknown;
        try {
          rawData = JSON.parse(event.data.toString());
        } catch (err) {
          sendError(ws, "Invalid JSON");
          return;
        }

        const message = parseWSMessage(rawData);
        if (!message) {
          sendError(ws, "Invalid message format");
          return;
        }

        handleClientMessage(clientId, message, ws).catch((err) => {
          console.error(`Error handling message from ${clientId.value}:`, err);
          sendError(ws, "Internal server error");
        });
      },

      onClose(_event, ws) {
        const clientId = clientIds.get(ws);
        if (!clientId) return;

        connections.delete(clientId);
        clientIds.delete(ws);
        console.log(
          `Client ${clientId.value} disconnected (${connections.size}/${MAX_CONNECTIONS})`
        );
      },
    };
  })
);

// ----------------------------------------------------------------------------
// Start server
// ----------------------------------------------------------------------------
const server = serve({
  fetch: app.fetch,
  port: Number(PORT),
});
injectWebSocket(server);
console.log(`Server running on http://localhost:${PORT}`);
