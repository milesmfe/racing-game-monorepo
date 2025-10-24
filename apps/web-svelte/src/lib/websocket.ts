import {
  parseServerMessage,
  WSProtocol,
  type ClientMessage,
  type LobbyList,
  type ServerMessage,
} from "@racing-game-mono/core";
import { writable, get } from "svelte/store";

const VITE_WS_URL = import.meta.env.VITE_WS_URL;
const CLIENT_ID_KEY = "clientId";

let ws: WebSocket | null = null;

export const connected = writable<boolean>(false);
export const errorMessage = writable<string>("");
export const serverMessage = writable<string>("");
export const id = writable<string>("");
export const joinedLobbyId = writable<string>("");
export const lobbyList = writable<LobbyList>([]);

export const connect = () => {
  if (ws) {
    ws.close();
  }
  ws = new WebSocket(VITE_WS_URL);
  ws.onopen = handleOpen;
  ws.onmessage = handleMessage;
  ws.onerror = handleError;
  ws.onclose = handleClose;
};

export const disconnect = () => {
  if (ws) {
    ws.close();
    ws = null;
  }
  connected.set(false);
  id.set("");
  joinedLobbyId.set("");
  lobbyList.set([]);
  serverMessage.set("");
  errorMessage.set("");
};

export const createLobby = () => {
  const message: ClientMessage = {
    protocol: WSProtocol.CREATE_LOBBY,
  };
  ws?.send(JSON.stringify(message));
};

export const joinLobby = (lobbyId: string) => {
  const message: ClientMessage = {
    protocol: WSProtocol.JOIN_LOBBY,
    id: lobbyId,
  };
  ws?.send(JSON.stringify(message));
};

export const leaveLobby = () => {
  const message: ClientMessage = {
    protocol: WSProtocol.LEAVE_LOBBY,
    id: get(joinedLobbyId),
  };
  ws?.send(JSON.stringify(message));
};

export const startGame = () => {
  const message: ClientMessage = {
    protocol: WSProtocol.START_GAME,
  };
  ws?.send(JSON.stringify(message));
};

function handleOpen() {
  connected.set(true);
  errorMessage.set("");

  const storedId = localStorage.getItem(CLIENT_ID_KEY);
  const message: ClientMessage = storedId
    ? { protocol: WSProtocol.RECONNECT, id: storedId }
    : { protocol: WSProtocol.CONNECT };

  console.log(
    storedId
      ? `Attempting to reconnect as ${storedId}...`
      : "Attempting to connect"
  );
  ws?.send(JSON.stringify(message));
}

function handleMessage(event: MessageEvent) {
  let message: ServerMessage;

  try {
    const rawMessage: unknown = JSON.parse(event.data.toString());
    message = parseServerMessage(rawMessage);
  } catch {
    errorMessage.set("Invalid message received from server");
    return;
  }

  serverMessage.set(JSON.stringify(message, undefined, 2));

  switch (message.protocol) {
    case WSProtocol.CONNECT:
      if (!message.success) {
        errorMessage.set(message.error);
        return;
      }
      handleConnectSuccess(message.id);
      break;

    case WSProtocol.RECONNECT:
      if (!message.success) {
        errorMessage.set(message.error);
        localStorage.removeItem(CLIENT_ID_KEY);
        return;
      }
      handleReconnectSuccess(message.id);
      break;

    case WSProtocol.GET_LOBBY_LIST:
      if (!message.success) {
        errorMessage.set(message.error);
        lobbyList.set([]);
        return;
      }
      lobbyList.set(message.lobbyList);
      errorMessage.set("");
      break;

    case WSProtocol.JOIN_LOBBY:
      if (!message.success) {
        errorMessage.set(message.error);
        return;
      }
      joinedLobbyId.set(message.id);
      errorMessage.set("");

      break;

    case WSProtocol.CREATE_LOBBY:
      if (!message.success) {
        errorMessage.set(message.error);
        return;
      }
      joinedLobbyId.set(message.id);
      errorMessage.set("");
      break;

    case WSProtocol.LEAVE_LOBBY:
      if (!message.success) {
        errorMessage.set(message.error);
        return;
      }
      joinedLobbyId.set("");
      errorMessage.set("");
      break;

    case WSProtocol.START_GAME:
      if (!message.success) {
        errorMessage.set(message.error);
        return;
      }
      // TODO: Implement start_game logic
      break;
  }
}

function handleConnectSuccess(clientId: string) {
  id.set(clientId);
  localStorage.setItem(CLIENT_ID_KEY, clientId);
  console.log(`Connected with ID: ${clientId}`);
}

function handleReconnectSuccess(clientId: string) {
  id.set(clientId);
  localStorage.setItem(CLIENT_ID_KEY, clientId);
  console.log(`Reconnected with ID: ${clientId}`);
}

function handleError(event: Event) {
  console.error("WebSocket error:", event);
  errorMessage.set("WebSocket error");
  connected.set(false);
}

function handleClose(event: CloseEvent) {
  connected.set(false);
  ws = null;
  id.set("");
  joinedLobbyId.set("");
  lobbyList.set([]);
  console.log(
    "Disconnected from server",
    event.reason ? `\n\tReason: ${event.reason}` : ""
  );
}
