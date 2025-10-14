<script lang="ts">
  import type { WSMessage } from "@racing-game-mono/core";

  let ws: WebSocket;
  let connected = false;

  function connect() {
    ws = new WebSocket("ws://localhost:3000/ws");

    ws.onopen = () => {
      connected = true;
      console.log("Connected to server");
    };

    ws.onmessage = (event) => {
      console.log("Message from server:", event.data);
    };

    ws.onclose = () => {
      connected = false;
      console.log("Disconnected");
    };
  }

  function send() {
    const message: WSMessage = { type: "join", playerId: "player1" };
    ws.send(JSON.stringify(message));
  }
</script>

<main>
  <h1>Racing Game</h1>
  <button on:click={connect} disabled={connected}>Connect</button>
  <button on:click={send} disabled={!connected}>Send Message</button>
  <p>Status: {connected ? "Connected" : "Disconnected"}</p>
</main>
