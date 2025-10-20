import { Hono } from "hono";
import { cors } from "hono/cors";
import { WSContext } from "hono/ws";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import "dotenv/config";

import {
  Id,
  createId,
  WSConnectCommand,
  WSMessageTarget,
  createWSMessage,
  parseWSMessage,
  type WSMessage,
  isConnectMessage,
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

const isClientInActiveSession = (clientId: Id): boolean => {
  return (
    gameHandler.getPlayerGameId(clientId) !== null ||
    lobbyHandler.getPlayerLobbyId(clientId) !== null
  );
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
      console.warn(`Client ${clientId} sent a CONNECT target message.`);
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
        // If server is at capacity, reject the connection
        if (connections.size >= MAX_CONNECTIONS) {
          ws.close(1001, "Server full");
          return;
        }
        // Otherwise, an unknown client has connected (no ID assigned yet)
        console.log("Unknown client connected");
      },

      onMessage(event, ws) {
        let rawData: unknown;
        try {
          rawData = JSON.parse(event.data.toString());
        } catch (err) {
          // Invalid JSON
          sendError(ws, "Invalid JSON");
          return;
        }

        const message = parseWSMessage(rawData);
        if (!message) {
          // Not a valid WSMessage
          sendError(ws, "Invalid message format");
          return;
        }

        let clientId = clientIds.get(ws);
        if (!clientId) {
          if (!isConnectMessage(message)) {
            // First message from unknown client was not a CONNECT command
            sendError(ws, "First message must be a CONNECT command");
            return;
          }

          // Handle a reconnect attempt
          if (message.command === WSConnectCommand.RECONNECT) {
            if (!message.data?.clientId) {
              sendError(ws, "RECONNECT command missing clientId");
              return;
            }
            clientId = message.data.clientId;
            // If client is not in an active session, treat as new connection
            if (!isClientInActiveSession(clientId)) {
              console.log(
                `Client ${clientId} failed to reconnect. Assigning new ID.`
              );
              clientId = createId();
              connections.set(clientId, ws);
              clientIds.set(ws, clientId);
              const welcome = createWSMessage.connect(
                WSConnectCommand.WELCOME,
                { clientId }
              );
              ws.send(JSON.stringify(welcome));
              return;
            }
            // Successful reconnection: reassign socket to existing clientId
            connections.set(clientId, ws);
            clientIds.set(ws, clientId);
            console.log(`Client ${clientId} reconnected successfully.`);
            const welcomeBack = createWSMessage.connect(
              WSConnectCommand.WELCOME_BACK,
              {
                clientId,
              }
            );
            ws.send(JSON.stringify(welcomeBack));
            // TODO: Send state data for lobby/game
            return;
          }

          if (message.command === WSConnectCommand.HELLO) {
            // New client connection: assign a fresh clientId
            clientId = createId();
            connections.set(clientId, ws);
            clientIds.set(ws, clientId);
            console.log(`Client ${clientId} connected.`);
            const welcome = createWSMessage.connect(WSConnectCommand.WELCOME, {
              clientId,
            });
            ws.send(JSON.stringify(welcome));
            return;
          }
          // Unknown client with invalid CONNECT command
          sendError(ws, "Invalid CONNECT command");
          return;
        }

        // Existing client: handle the message for lobby/game
        handleClientMessage(clientId, message, ws).catch((err) => {
          console.error(`Error handling message from ${clientId}:`, err);
          sendError(ws, "Internal server error");
        });
      },

      onClose(_event, ws) {
        // If socket had no assigned clientId, it was an unknown client
        const clientId = clientIds.get(ws);
        if (!clientId) {
          console.log("Unknown client disconnected");
          return;
        }

        // Known client disconnected: clean up
        connections.delete(clientId);
        clientIds.delete(ws);
        console.log(
          `Client ${clientId} disconnected (${connections.size}/${MAX_CONNECTIONS})`
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
