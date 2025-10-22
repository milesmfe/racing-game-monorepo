<script lang="ts">
  import {
    parseServerMessage,
    WSProtocol,
    type ServerMessage,
    type ClientMessage,
    type LobbyList,
  } from "@racing-game-mono/core";

  let ws: WebSocket | null = null;
  let connected: boolean = false;
  let errorMessage: string = "";
  let serverMessage: string = "";
  let id: string = "";
  let joinedLobbyId: string = "";
  let lobbyList: LobbyList = [];

  const CLIENT_ID_KEY = "clientId";

  function create() {
    const message: ClientMessage = {
      protocol: WSProtocol.CREATE_LOBBY,
    };
    ws?.send(JSON.stringify(message));
  }

  function join(lobbyId: string) {
    const message: ClientMessage = {
      protocol: WSProtocol.JOIN_LOBBY,
      id: lobbyId,
    };
    ws?.send(JSON.stringify(message));
  }

  function leave() {
    const message: ClientMessage = {
      protocol: WSProtocol.LEAVE_LOBBY,
      id: joinedLobbyId,
    };
    ws?.send(JSON.stringify(message));
  }

  function start() {
    const message: ClientMessage = {
      protocol: WSProtocol.START_GAME,
    };
    ws?.send(JSON.stringify(message));
  }

  function connect() {
    ws = new WebSocket(import.meta.env.VITE_WS_URL);

    ws.onopen = handleOpen;
    ws.onmessage = handleMessage;
    ws.onerror = handleError;
    ws.onclose = handleClose;
  }

  function handleOpen() {
    connected = true;
    errorMessage = "";

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
      errorMessage = "Invalid message received from server";
      return;
    }

    serverMessage = JSON.stringify(message, undefined, 2);

    switch (message.protocol) {
      case WSProtocol.CONNECT:
        if (message.success) {
          handleConnectSuccess(message.id);
        } else {
          errorMessage = message.error;
        }
        break;

      case WSProtocol.RECONNECT:
        if (message.success) {
          handleReconnectSuccess(message.id);
        } else {
          errorMessage = message.error;
          localStorage.removeItem(CLIENT_ID_KEY);
        }
        break;

      case WSProtocol.GET_LOBBY_LIST:
        if (message.success) {
          lobbyList = message.lobbyList;
          errorMessage = "";
        } else {
          errorMessage = message.error;
          lobbyList = [];
        }
        break;

      case WSProtocol.JOIN_LOBBY:
        if (message.success) {
          joinedLobbyId = message.id;
          errorMessage = "";
        } else {
          errorMessage = message.error;
        }
        break;

      case WSProtocol.CREATE_LOBBY:
        if (message.success) {
          joinedLobbyId = message.id;
          errorMessage = "";
        } else {
          errorMessage = message.error;
        }
        break;

      case WSProtocol.LEAVE_LOBBY:
        if (message.success) {
          joinedLobbyId = "";
          errorMessage = "";
        } else {
          errorMessage = message.error;
        }
        break;

      case WSProtocol.START_GAME:
        if (!message.success) {
          errorMessage = message.error;
        }
        // TODO: Implement start_game logic
        break;

      default:
        break;
    }
  }

  function handleConnectSuccess(clientId: string) {
    id = clientId;
    localStorage.setItem(CLIENT_ID_KEY, id);
    console.log(`Connected with ID: ${id}`);
  }

  function handleReconnectSuccess(clientId: string) {
    id = clientId;
    console.log(`Reconnected with ID: ${id}`);
  }

  function handleError(event: Event) {
    console.error("WebSocket error:", event);
    errorMessage = "Connection error";
    connected = false;
  }

  function handleClose(event: CloseEvent) {
    connected = false;
    ws = null;
    id = "";
    errorMessage = "";
    serverMessage = "";
    console.log(
      "Disconnected from server",
      event.reason ? `\n\tReason: ${event.reason}` : ""
    );
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
    }
    connected = false;
    id = "";
    errorMessage = "";
  }
</script>

<main>
  <h1>Racing Game</h1>

  <div class="controls">
    <button on:click={connect} disabled={connected}>Connect</button>
    <button on:click={disconnect} disabled={!connected}>Disconnect</button>
    <button on:click={create} disabled={!connected || !!joinedLobbyId}
      >Create</button
    >
    <button on:click={leave} disabled={!connected || !joinedLobbyId}
      >Leave</button
    >
    <button on:click={start} disabled={!connected || !joinedLobbyId}
      >Start</button
    >
  </div>

  <div class="lobbyList" hidden={!connected || !lobbyList}>
    <p>
      <strong>Available Lobbies:</strong>
    </p>
    {#each lobbyList as lobby}
      <div class="lobby">
        <p>
          <strong>Lobby ID:</strong>
          {lobby.id}
        </p>
        <p>
          <strong>Player Count:</strong>
          {lobby.playerCount}
        </p>
        <p>
          <strong>Max Players:</strong>
          {lobby.maxPlayers}
        </p>
        <button
          on:click={() => {
            join(lobby.id);
          }}
          disabled={lobby.id === joinedLobbyId}>Join</button
        >
      </div>
    {/each}
  </div>

  <div class="status">
    <p>
      <strong>Status:</strong>
      {connected ? "Connected" : "Disconnected"}
    </p>
    {#if id}
      <p><strong>Client ID:</strong> {id}</p>
    {/if}
    {#if joinedLobbyId}
      <p>
        <strong>Lobby ID:</strong>
        {joinedLobbyId}
      </p>
    {/if}
    {#if serverMessage}
      <p><strong>Latest Message:</strong></p>
      <pre>{serverMessage}</pre>
    {/if}
    {#if errorMessage}
      <p class="error"><strong>Error:</strong> {errorMessage}</p>
    {/if}
  </div>
</main>
