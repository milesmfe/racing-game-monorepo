<script lang="ts">
  import {
    WSConnectCommand,
    WSLobbyCommand,
    WSGameCommand,
    createWSMessage,
    parseWSMessage,
    isErrorMessage,
    isConnectMessage,
    type WSMessage,
  } from "@racing-game-mono/core";

  let ws: WebSocket | null = null;
  let connected = false;
  let clientId: string = "";
  let result: string = "";
  let error: string = "";

  function connect() {
    try {
      ws = new WebSocket(import.meta.env.VITE_WS_URL);

      ws.onopen = () => {
        connected = true;
        error = "";
        console.log("Connected to server");
      };

      ws.onmessage = (event) => {
        console.log("Message from server:", event.data);
        let rawData: unknown;
        try {
          rawData = JSON.parse(event.data);
        } catch (err) {
          error = "Invalid JSON from server";
          return;
        }

        const message = parseWSMessage(rawData);
        if (!message) {
          error = "Invalid message format from server";
          return;
        }

        handleMessage(message);
      };

      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        error = "Connection error";
        connected = false;
      };

      ws.onclose = () => {
        connected = false;
        ws = null;
        console.log("Disconnected");
      };
    } catch (err) {
      console.error("Failed to connect:", err);
      error = "Failed to connect to server";
    }
  }

  function handleMessage(message: WSMessage) {
    if (isErrorMessage(message)) {
      error = message.data.message;
      result = `Error: ${message.data.message}`;
      return;
    }

    error = "";
    if (
      isConnectMessage(message) &&
      message.command === WSConnectCommand.WELCOME
    ) {
      clientId = message.data ? message.data.clientId : "";
      result = "Connected successfully";
    } else {
      result = `Message received: ${JSON.stringify(message)}`;
    }
  }

  function sendMessage(message: WSMessage) {
    if (!ws || !connected) {
      error = "Not connected";
      return;
    }
    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      console.error("Failed to send message:", err);
      error = "Failed to send message";
    }
  }

  function sendLobbyMessage() {
    const message = createWSMessage.lobby(WSLobbyCommand.CREATE);
    sendMessage(message);
  }

  function sendGameMessage() {
    const message = createWSMessage.game(WSGameCommand.ACTION);
    sendMessage(message);
  }

  function disconnect() {
    if (ws) {
      ws.close();
    }
    connected = false;
    clientId = "";
    result = "";
    error = "";
  }
</script>

<main>
  <h1>Racing Game</h1>

  <div class="controls">
    <button on:click={connect} disabled={connected}>Connect</button>
    <button on:click={disconnect} disabled={!connected}>Disconnect</button>
    <button on:click={sendLobbyMessage} disabled={!connected}
      >Send Lobby Message</button
    >
    <button on:click={sendGameMessage} disabled={!connected}
      >Send Game Message</button
    >
  </div>

  <div class="status">
    <p><strong>Status:</strong> {connected ? "Connected" : "Disconnected"}</p>
    {#if clientId}
      <p><strong>Client ID:</strong> {clientId}</p>
    {/if}
    {#if result}
      <p><strong>Result:</strong> {result}</p>
    {/if}
    {#if error}
      <p class="error"><strong>Error:</strong> {error}</p>
    {/if}
  </div>
</main>
