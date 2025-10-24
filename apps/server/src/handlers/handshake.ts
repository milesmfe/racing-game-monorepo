import { WSContext } from "hono/ws";
import {
  createId,
  ClientMessage,
  ServerConnectMessage,
  ServerReconnectMessage,
  WSProtocol,
} from "@racing-game-mono/core";
import { state } from "../utils/state";
import { config } from "../utils/config";
import { send, closeWithError, broadcastLobbyList } from "../utils/messaging";

export const handleConnect = (ws: WSContext): boolean => {
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

export const handleReconnect = (msg: ClientMessage, ws: WSContext): boolean => {
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
