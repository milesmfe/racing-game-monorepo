import { WSContext } from "hono/ws";
import { fileURLToPath } from "url";
import {
  Id,
  createId,
  ClientMessage,
  WSProtocol,
  TrackList,
  parseServerMessage,
} from "@racing-game-mono/core";
import { state } from "../utils/state";
import { Lobby } from "../classes/Lobby";
import {
  sendSuccess,
  sendError,
  broadcastLobbyList,
  getLobbyList,
} from "../utils/messaging";
import { readFile } from "fs/promises";
import path from "path";
import { readdir } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tracksDirPath = path.join(__dirname, "../../data/tracks");

type Handler = (
  msg: ClientMessage,
  ws: WSContext,
  clientId: Id
) => Promise<void> | void;

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

const handleGetTrackList: Handler = async (msg, ws) => {
  if (msg.protocol !== WSProtocol.GET_TRACK_LIST) return;
  try {
    const files = readdir(tracksDirPath, async (err, files) => {
      if (err) {
        console.error(err);
        return;
      }
      const trackFiles = files.filter((file) => file.endsWith(".json"));
      const trackList: TrackList = [];
      for (const file of trackFiles) {
        const filePath = path.join(tracksDirPath, file);
        const data = await readFile(filePath, "utf8");
        trackList.push(JSON.parse(data));
      }
      parseServerMessage({
        protocol: WSProtocol.GET_TRACK_LIST,
        success: true,
        trackList,
      });
      sendSuccess(ws, {
        protocol: WSProtocol.GET_TRACK_LIST,
        success: true,
        trackList,
      });
    });
  } catch (err) {
    console.error(err);
    sendError(ws, WSProtocol.GET_TRACK_LIST, "Error reading track files");
  }
};

export const handlers: Record<WSProtocol, Handler> = {
  [WSProtocol.CONNECT]: () => {},
  [WSProtocol.RECONNECT]: () => {},
  [WSProtocol.GET_LOBBY_LIST]: handleGetLobbyList,
  [WSProtocol.CREATE_LOBBY]: handleCreateLobby,
  [WSProtocol.JOIN_LOBBY]: handleJoinLobby,
  [WSProtocol.LEAVE_LOBBY]: handleLeaveLobby,
  [WSProtocol.START_GAME]: handleStartGame,
  [WSProtocol.GET_TRACK_LIST]: handleGetTrackList,
};
