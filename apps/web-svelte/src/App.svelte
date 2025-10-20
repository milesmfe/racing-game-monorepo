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
        console.log("WebSocket connection opened. Starting handshake...");

        // After connecting, the client must identify itself.
        const storedClientId = localStorage.getItem("clientId");
        if (storedClientId) {
          // If we have an ID, attempt to reconnect with it.
          console.log(`Attempting to reconnect as ${storedClientId}...`);
          const message = createWSMessage.connect(WSConnectCommand.RECONNECT, {
            clientId: storedClientId,
          });
          sendMessage(message);
        } else {
          // If we have no ID, we are a new client. Send HELLO.
          console.log("New client, sending HELLO to get a session ID.");
          const message = createWSMessage.connect(WSConnectCommand.HELLO);
          sendMessage(message);
        }
      };

      ws.onmessage = (event) => {
        console.log("Message from server:", event.data);
        let rawData: unknown;
        try {
          rawData = JSON.parse(event.data);
        } catch (e) {
          error = "Invalid JSON received from server.";
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
        console.log("Disconnected from server.");
      };
    } catch (err) {
      console.error("Failed to initiate connection:", err);
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
    // The server confirms both new and reconnected sessions with WELCOME or WELCOME_BACK
    if (
      isConnectMessage(message) &&
      (message.command === WSConnectCommand.WELCOME ||
        message.command === WSConnectCommand.WELCOME_BACK)
    ) {
      // The `data` field might be optional in the schema, so we check for its existence
      if (message.data) {
        clientId = message.data.clientId;
        result =
          message.command === WSConnectCommand.WELCOME_BACK
            ? "Reconnected successfully!"
            : "Session established successfully!";

        // Store the confirmed client ID for future sessions
        localStorage.setItem("clientId", clientId);
        console.log(`Session confirmed with client ID: ${clientId}`);
      }
    } else {
      result = `Message received: ${JSON.stringify(message)}`;
    }
  }

  function sendMessage(message: WSMessage) {
    // We need to wait for the socket to be open before sending.
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // If not open, retry shortly. This handles the race condition on initial connection.
      setTimeout(() => sendMessage(message), 100);
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
    // Note: We do NOT clear localStorage, allowing the user to reconnect.
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
