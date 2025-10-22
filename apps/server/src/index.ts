import { Hono } from "hono";
import { cors } from "hono/cors";
import { WSContext } from "hono/ws";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";

import {
  Id,
  createId,
  WSProtocol,
  ClientMessage,
  ServerMessage,
  parseClientMessage,
  LobbyList,
} from "@racing-game-mono/core";
import { Lobby } from "./Lobby";

// ----------------------------------------------------------------------------
// State & Connections
// ----------------------------------------------------------------------------
const connections = new Map<Id, WSContext>();
const clientIds = new WeakMap<WSContext, Id>();
const verifiedClientIds = Array<Id>();
const lobbies = new Map<Id, Lobby>();

function getLobbyList(): LobbyList {
  return Array.from(lobbies.values()).map((lobby) => {
    return {
      id: lobby.id,
      playerCount: lobby.getPlayerCount(),
      maxPlayers: lobby.getMaxPlayers(),
    };
  });
}

function broadcastLobbyList() {
  const lobbyList = getLobbyList();
  connections.forEach((connection) => {
    const res: ServerMessage = {
      protocol: WSProtocol.GET_LOBBY_LIST,
      success: true,
      lobbyList,
    };
    connection.send(JSON.stringify(res));
  });
}

// ----------------------------------------------------------------------------
// Hono Setup
// ----------------------------------------------------------------------------
const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

const PORT: number = process.env.PORT || 3000;
const MAX_CONNECTIONS = process.env.MAX_CONNECTIONS || 100;
const NODE_ENV: string = process.env.NODE_ENV || "development";

app.use("/*", cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || [] }));

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
          if (!verifiedClientIds.includes(message.id)) {
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
          broadcastLobbyList();
          return;
        }

        // Handle CONNECT for unknown connections
        if (!clientId && message.protocol === WSProtocol.CONNECT) {
          const id = createId();
          connections.set(id, ws);
          clientIds.set(ws, id);
          verifiedClientIds.push(id);

          console.log(
            `${id} connected (${connections.size}/${MAX_CONNECTIONS})`
          );

          res = {
            protocol: WSProtocol.CONNECT,
            id,
            success: true,
          };
          ws.send(JSON.stringify(res));
          broadcastLobbyList();
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
          case WSProtocol.GET_LOBBY_LIST: {
            res = {
              protocol: WSProtocol.GET_LOBBY_LIST,
              success: true,
              lobbyList: getLobbyList(),
            };
            ws.send(JSON.stringify(res));
            break;
          }

          case WSProtocol.CREATE_LOBBY: {
            const lobbyId = createId();
            lobbies.set(lobbyId, new Lobby(lobbyId, clientId, ws));
            res = {
              protocol: WSProtocol.CREATE_LOBBY,
              success: true,
              id: lobbyId,
            };
            ws.send(JSON.stringify(res));
            broadcastLobbyList();
            break;
          }

          case WSProtocol.JOIN_LOBBY: {
            const lobby = lobbies.get(message.id);
            if (!lobby) {
              res = {
                protocol: WSProtocol.JOIN_LOBBY,
                success: false,
                error: "Lobby not found",
              };
              ws.send(JSON.stringify(res));
              break;
            }
            if (!lobby.addPlayer(clientId, ws)) {
              res = {
                protocol: WSProtocol.JOIN_LOBBY,
                success: false,
                error: "Lobby full",
              };
              ws.send(JSON.stringify(res));
              break;
            }

            res = {
              protocol: WSProtocol.JOIN_LOBBY,
              success: true,
              id: lobby.id,
            };
            ws.send(JSON.stringify(res));
            broadcastLobbyList();
            break;
          }

          case WSProtocol.LEAVE_LOBBY: {
            const lobby = lobbies.get(message.id);
            if (!lobby) {
              res = {
                protocol: WSProtocol.LEAVE_LOBBY,
                success: false,
                error: "Lobby not found",
              };
              ws.send(JSON.stringify(res));
              break;
            }
            if (!lobby.removePlayer(clientId)) {
              res = {
                protocol: WSProtocol.LEAVE_LOBBY,
                success: false,
                error: "Player not in lobby",
              };
              ws.send(JSON.stringify(res));
              break;
            }
            if (lobby.isEmpty()) {
              lobbies.delete(lobby.id);
            }
            res = {
              protocol: WSProtocol.LEAVE_LOBBY,
              success: true,
            };
            ws.send(JSON.stringify(res));
            broadcastLobbyList();
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

      onClose(event, ws) {
        // If socket had no assigned clientId, it was an unknown client
        const clientId = clientIds.get(ws);
        if (!clientId) {
          return;
        }

        // Known client disconnected: clean up
        connections.delete(clientId);
        clientIds.delete(ws);
        console.log(
          `Client ${clientId} disconnected (${connections.size}/${MAX_CONNECTIONS})`,
          event.reason ? `\n\tReason: ${event.reason}` : ""
        );
      },
    };
  })
);

// ----------------------------------------------------------------------------
// Serve Frontend in Production
// ----------------------------------------------------------------------------
if (NODE_ENV === "production") {
  // TODO: Implement frontend serving
} else if (NODE_ENV === "development") {
  app.get("/", (c) => c.json({ message: "Racing Game Server", env: NODE_ENV }));
}

// ----------------------------------------------------------------------------
// Start server
// ----------------------------------------------------------------------------
const server = serve({
  fetch: app.fetch,
  port: Number(PORT),
});
injectWebSocket(server);
console.log(`Server running on http://localhost:${PORT}`);
