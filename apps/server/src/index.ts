import { Hono } from "hono";
import { cors } from "hono/cors";
import { WSContext } from "hono/ws";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import "dotenv/config";

import {
  Id,
  createId,
  WSProtocol,
  ClientMessage,
  ServerMessage,
  parseClientMessage,
} from "@racing-game-mono/core";
// import LobbyHandler from "./game/LobbyHandler";
// import GameHandler from "./game/GameHandler";

// ----------------------------------------------------------------------------
// State & Connections
// ----------------------------------------------------------------------------
const connections = new Map<Id, WSContext>();
const clientIds = new WeakMap<WSContext, Id>();
// const lobbyHandler = new LobbyHandler();
// const gameHandler = new GameHandler();
const testKnownClients = Array<Id>();

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
      },

      onMessage(event, ws) {
        // Parse and validate message
        let message: ClientMessage;
        try {
          const rawMessage: unknown = JSON.parse(event.data.toString());
          message = parseClientMessage(rawMessage);
        } catch {
          ws.close(1003, "Invalid message");
          return;
        }

        let clientId = clientIds.get(ws);
        let res: ServerMessage;

        // Handle RECONNECT for unknown connections
        if (!clientId && message.protocol === WSProtocol.RECONNECT) {
          if (!testKnownClients.includes(message.id)) {
            res = {
              protocol: WSProtocol.RECONNECT,
              success: false,
              error: "Reconnect failed: unknown client",
            };
            ws.send(JSON.stringify(res));
            ws.close(1008, "Reconnect failed");
            return;
          }

          connections.set(message.id, ws);
          clientIds.set(ws, message.id);
          clientId = message.id;

          // TODO: Notify game/lobby of reconnection
          console.log(
            `${clientId} reconnected (${connections.size}/${MAX_CONNECTIONS})`
          );

          res = {
            protocol: WSProtocol.RECONNECT,
            id: clientId,
            success: true,
          };
          ws.send(JSON.stringify(res));
          return;
        }

        // Handle CONNECT for unknown connections
        if (!clientId && message.protocol === WSProtocol.CONNECT) {
          const id = createId();
          connections.set(id, ws);
          clientIds.set(ws, id);
          testKnownClients.push(id); // TEST

          console.log(
            `${id} connected (${connections.size}/${MAX_CONNECTIONS})`
          );

          res = {
            protocol: WSProtocol.CONNECT,
            id,
            success: true,
          };
          ws.send(JSON.stringify(res));
          return;
        }

        // Unknown connections must CONNECT or RECONNECT first
        if (!clientId) {
          res = {
            protocol: WSProtocol.CONNECT,
            success: false,
            error: "First message must be CONNECT",
          };
          ws.send(JSON.stringify(res));
          ws.close(1008, "First message must be CONNECT");
          return;
        }

        // Handle known client messages
        switch (message.protocol) {
          case WSProtocol.CREATE_LOBBY: {
            // TODO: Implement lobby creation
            res = {
              protocol: WSProtocol.CREATE_LOBBY,
              success: false,
              error: "Not yet implemented",
            };
            ws.send(JSON.stringify(res));
            break;
          }

          case WSProtocol.JOIN_LOBBY: {
            // TODO: Implement lobby joining
            res = {
              protocol: WSProtocol.JOIN_LOBBY,
              success: false,
              error: "Not yet implemented",
            };
            ws.send(JSON.stringify(res));
            break;
          }

          case WSProtocol.LEAVE_LOBBY: {
            // TODO: Implement lobby leaving
            res = {
              protocol: WSProtocol.LEAVE_LOBBY,
              success: false,
              error: "Not yet implemented",
            };
            ws.send(JSON.stringify(res));
            break;
          }

          case WSProtocol.START_GAME: {
            // TODO: Implement game start
            res = {
              protocol: WSProtocol.START_GAME,
              success: false,
              error: "Not yet implemented",
            };
            ws.send(JSON.stringify(res));
            break;
          }

          default:
            break;
        }
      },

      onClose(_event, ws) {
        // If socket had no assigned clientId, it was an unknown client
        const clientId = clientIds.get(ws);
        if (!clientId) {
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
