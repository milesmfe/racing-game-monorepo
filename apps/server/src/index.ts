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
  ServerConnectMessage,
  ServerReconnectMessage,
  ServerGetLobbyListMessage,
  parseClientMessage,
  LobbyList,
} from "@racing-game-mono/core";
import { Lobby } from "./Lobby";

// ----------------------------------------------------------------------------
// State & Configuration
// ----------------------------------------------------------------------------
const state = {
  connections: new Map<Id, WSContext>(),
  clientIds: new WeakMap<WSContext, Id>(),
  verifiedIds: new Set<Id>(),
  lobbies: new Map<Id, Lobby>(),
};

const config = {
  PORT: Number(process.env.PORT || 3000),
  MAX_CONNECTIONS: Number(process.env.MAX_CONNECTIONS || 100),
  NODE_ENV: process.env.NODE_ENV || "development",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(",") || [],
};

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------
const getLobbyList = (): LobbyList =>
  Array.from(state.lobbies.values()).map((l) => ({
    id: l.id,
    playerCount: l.getPlayerCount(),
    maxPlayers: l.getMaxPlayers(),
  }));

const broadcast = (message: ServerMessage) =>
  state.connections.forEach((ws) => ws.send(JSON.stringify(message)));

const broadcastLobbyList = () => {
  const message: ServerGetLobbyListMessage = {
    protocol: WSProtocol.GET_LOBBY_LIST,
    success: true,
    lobbyList: getLobbyList(),
  };
  broadcast(message);
};

const send = (ws: WSContext, message: ServerMessage) =>
  ws.send(JSON.stringify(message));

const closeWithError = (ws: WSContext, code: number, reason: string) =>
  ws.close(code, reason);

// ----------------------------------------------------------------------------
// Connection Handshake Handlers
// ----------------------------------------------------------------------------
const handleConnect = (ws: WSContext): boolean => {
  const id = createId();
  state.connections.set(id, ws);
  state.clientIds.set(ws, id);
  state.verifiedIds.add(id);

  console.log(
    `${id} connected (${state.connections.size}/${config.MAX_CONNECTIONS})`
  );

  const res: ServerConnectMessage = {
    protocol: WSProtocol.CONNECT,
    success: true,
    id,
  };
  send(ws, res);
  broadcastLobbyList();
  return true;
};

const handleReconnect = (msg: ClientMessage, ws: WSContext): boolean => {
  if (msg.protocol !== WSProtocol.RECONNECT) return false;

  if (!state.verifiedIds.has(msg.id)) {
    const res: ServerReconnectMessage = {
      protocol: WSProtocol.RECONNECT,
      success: false,
      error: "Reconnect failed: unknown client",
    };
    send(ws, res);
    closeWithError(ws, 1008, "Reconnect failed");
    return false;
  }

  state.connections.set(msg.id, ws);
  state.clientIds.set(ws, msg.id);

  console.log(
    `${msg.id} reconnected (${state.connections.size}/${config.MAX_CONNECTIONS})`
  );

  const res: ServerReconnectMessage = {
    protocol: WSProtocol.RECONNECT,
    success: true,
    id: msg.id,
  };
  send(ws, res);
  broadcastLobbyList();
  return true;
};

// ----------------------------------------------------------------------------
// Message Handlers
// ----------------------------------------------------------------------------
type Handler = (msg: ClientMessage, ws: WSContext, clientId: Id) => void;

const sendSuccess = <T extends ServerMessage>(
  ws: WSContext,
  response: T
): void => {
  send(ws, response);
};

const sendError = <T extends WSProtocol>(
  ws: WSContext,
  protocol: T,
  error: string
): void => {
  send(ws, { protocol, success: false, error } as ServerMessage);
};

const handleGetLobbyList: Handler = (_, ws) => {
  sendSuccess(ws, {
    protocol: WSProtocol.GET_LOBBY_LIST,
    success: true,
    lobbyList: getLobbyList(),
  });
};

const handleCreateLobby: Handler = (_, ws, clientId) => {
  const lobbyId = createId();
  state.lobbies.set(lobbyId, new Lobby(lobbyId, clientId, ws));

  sendSuccess(ws, {
    protocol: WSProtocol.CREATE_LOBBY,
    success: true,
    id: lobbyId,
  });
  broadcastLobbyList();
};

const handleJoinLobby: Handler = (msg, ws, clientId) => {
  if (msg.protocol !== WSProtocol.JOIN_LOBBY) return;

  const lobby = state.lobbies.get(msg.id);

  if (!lobby) {
    return sendError(ws, WSProtocol.JOIN_LOBBY, "Lobby not found");
  }

  if (!lobby.addPlayer(clientId, ws)) {
    return sendError(ws, WSProtocol.JOIN_LOBBY, "Lobby full");
  }

  sendSuccess(ws, {
    protocol: WSProtocol.JOIN_LOBBY,
    success: true,
    id: lobby.id,
  });
  broadcastLobbyList();
};

const handleLeaveLobby: Handler = (msg, ws, clientId) => {
  if (msg.protocol !== WSProtocol.LEAVE_LOBBY) return;

  const lobby = state.lobbies.get(msg.id);

  if (!lobby) {
    return sendError(ws, WSProtocol.LEAVE_LOBBY, "Lobby not found");
  }

  if (!lobby.removePlayer(clientId)) {
    return sendError(ws, WSProtocol.LEAVE_LOBBY, "Player not in lobby");
  }

  if (lobby.isEmpty()) {
    state.lobbies.delete(lobby.id);
  }

  sendSuccess(ws, {
    protocol: WSProtocol.LEAVE_LOBBY,
    success: true,
  });
  broadcastLobbyList();
};

const handleStartGame: Handler = (_, ws) => {
  sendError(ws, WSProtocol.START_GAME, "Not yet implemented");
};

const handlers: Record<WSProtocol, Handler> = {
  [WSProtocol.CONNECT]: () => {},
  [WSProtocol.RECONNECT]: () => {},
  [WSProtocol.GET_LOBBY_LIST]: handleGetLobbyList,
  [WSProtocol.CREATE_LOBBY]: handleCreateLobby,
  [WSProtocol.JOIN_LOBBY]: handleJoinLobby,
  [WSProtocol.LEAVE_LOBBY]: handleLeaveLobby,
  [WSProtocol.START_GAME]: handleStartGame,
};

// ----------------------------------------------------------------------------
// WebSocket Setup
// ----------------------------------------------------------------------------
const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("/*", cors({ origin: config.ALLOWED_ORIGINS }));

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen(_event, ws) {
      if (state.connections.size >= config.MAX_CONNECTIONS) {
        closeWithError(ws, 1001, "Server full");
      }
    },

    onMessage(event, ws) {
      let message: ClientMessage;
      try {
        message = parseClientMessage(JSON.parse(event.data.toString()));
      } catch {
        return closeWithError(ws, 1003, "Invalid message");
      }

      const clientId = state.clientIds.get(ws);

      if (!clientId) {
        if (message.protocol === WSProtocol.CONNECT) return handleConnect(ws);
        if (message.protocol === WSProtocol.RECONNECT)
          return handleReconnect(message, ws);

        const res: ServerConnectMessage = {
          protocol: WSProtocol.CONNECT,
          success: false,
          error: "First message must be CONNECT",
        };
        send(ws, res);
        return closeWithError(ws, 1008, "First message must be CONNECT");
      }

      handlers[message.protocol]?.(message, ws, clientId);
    },

    onClose(event, ws) {
      const clientId = state.clientIds.get(ws);
      if (!clientId) return;

      state.connections.delete(clientId);
      state.clientIds.delete(ws);
      console.log(
        `Client ${clientId} disconnected (${state.connections.size}/${config.MAX_CONNECTIONS})`,
        event.reason ? `\n\tReason: ${event.reason}` : ""
      );
    },
  }))
);

// ----------------------------------------------------------------------------
// Serve Frontend
// ----------------------------------------------------------------------------
if (config.NODE_ENV === "production") {
  // TODO: Implement frontend serving
} else {
  app.get("/", (c) =>
    c.json({ message: "Racing Game Server", env: config.NODE_ENV })
  );
}

// ----------------------------------------------------------------------------
// Start Server
// ----------------------------------------------------------------------------
const server = serve({ fetch: app.fetch, port: config.PORT });
injectWebSocket(server);
console.log(`Server running on http://localhost:${config.PORT}`);
