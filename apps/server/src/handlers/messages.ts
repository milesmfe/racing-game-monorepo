import { WSContext } from "hono/ws";
import {
  Id,
  createId,
  ClientMessage,
  WSProtocol,
} from "@racing-game-mono/core";
import { state } from "../utils/state";
import { Lobby } from "../classes/Lobby";
import {
  sendSuccess,
  sendError,
  broadcastLobbyList,
  getLobbyList,
} from "../utils/messaging";

type Handler = (msg: ClientMessage, ws: WSContext, clientId: Id) => void;

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

export const handlers: Record<WSProtocol, Handler> = {
  [WSProtocol.CONNECT]: () => {},
  [WSProtocol.RECONNECT]: () => {},
  [WSProtocol.GET_LOBBY_LIST]: handleGetLobbyList,
  [WSProtocol.CREATE_LOBBY]: handleCreateLobby,
  [WSProtocol.JOIN_LOBBY]: handleJoinLobby,
  [WSProtocol.LEAVE_LOBBY]: handleLeaveLobby,
  [WSProtocol.START_GAME]: handleStartGame,
};
