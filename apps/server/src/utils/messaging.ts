import { WSContext } from "hono/ws";
import {
  ServerMessage,
  ServerGetLobbyListMessage,
  WSProtocol,
  LobbyList,
} from "@racing-game-mono/core";
import { state } from "../state";

export const getLobbyList = (): LobbyList =>
  Array.from(state.lobbies.values()).map((l) => ({
    id: l.id,
    playerCount: l.getPlayerCount(),
    maxPlayers: l.getMaxPlayers(),
  }));

export const broadcast = (message: ServerMessage) =>
  state.connections.forEach((ws) => ws.send(JSON.stringify(message)));

export const broadcastLobbyList = () => {
  const message: ServerGetLobbyListMessage = {
    protocol: WSProtocol.GET_LOBBY_LIST,
    success: true,
    lobbyList: getLobbyList(),
  };
  broadcast(message);
};

export const send = (ws: WSContext, message: ServerMessage) =>
  ws.send(JSON.stringify(message));

export const closeWithError = (ws: WSContext, code: number, reason: string) =>
  ws.close(code, reason);

export const sendSuccess = <T extends ServerMessage>(
  ws: WSContext,
  response: T
): void => {
  send(ws, response);
};

export const sendError = <T extends WSProtocol>(
  ws: WSContext,
  protocol: T,
  error: string
): void => {
  send(ws, { protocol, success: false, error } as ServerMessage);
};
