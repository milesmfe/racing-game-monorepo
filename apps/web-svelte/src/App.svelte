<script lang="ts">
  import {
    parseServerMessage,
    WSProtocol,
    type ServerMessage,
    type ClientMessage,
  } from "@racing-game-mono/core";

  let ws: WebSocket | null = null;
  let connected: boolean = false;
  let errorMessage: string = "";
  let serverMessage: string = "";
  let id: string = "";

  const CLIENT_ID_KEY = "clientId";

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

      case WSProtocol.CREATE_LOBBY:
      case WSProtocol.JOIN_LOBBY:
      case WSProtocol.LEAVE_LOBBY:
      case WSProtocol.START_GAME:
        if (!message.success) {
          errorMessage = message.error;
        }
        // TODO: Implement lobby/game message handlers
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

  function handleClose() {
    connected = false;
    console.log("Disconnected from server");
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
  </div>

  <div class="status">
    <p>
      <strong>Status:</strong>
      {connected ? "Connected" : "Disconnected"}
    </p>
    {#if id}
      <p><strong>Client ID:</strong> {id}</p>
    {/if}
    {#if serverMessage}
      <p><strong>Result:</strong></p>
      <pre>{serverMessage}</pre>
    {/if}
    {#if errorMessage}
      <p class="error"><strong>Error:</strong> {errorMessage}</p>
    {/if}
  </div>
</main>
