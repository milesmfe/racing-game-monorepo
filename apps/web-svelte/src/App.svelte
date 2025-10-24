<script lang="ts">
  import {
    connected,
    errorMessage,
    serverMessage,
    id,
    joinedLobbyId,
    lobbyList,
    connect,
    disconnect,
    createLobby as create,
    joinLobby as join,
    leaveLobby as leave,
    startGame as start,
  } from "@lib/websocket";
</script>

<main>
  <h1>Racing Game</h1>

  <div class="controls">
    <button on:click={connect} disabled={$connected}>Connect</button>
    <button on:click={disconnect} disabled={!$connected}>Disconnect</button>
    <button on:click={create} disabled={!$connected || !!$joinedLobbyId}
      >Create</button
    >
    <button on:click={leave} disabled={!$connected || !$joinedLobbyId}
      >Leave</button
    >
    <button on:click={start} disabled={!$connected || !$joinedLobbyId}
      >Start</button
    >
  </div>

  <div class="lobbyList" hidden={!$connected || !$lobbyList}>
    <p>
      <strong>Available Lobbies:</strong>
    </p>
    {#each $lobbyList as lobby}
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
          disabled={lobby.id === $joinedLobbyId}>Join</button
        >
      </div>
    {/each}
  </div>

  <div class="status">
    <p>
      <strong>Status:</strong>
      {$connected ? "Connected" : "Disconnected"}
    </p>
    {#if $id}
      <p><strong>Client ID:</strong> {$id}</p>
    {/if}
    {#if $joinedLobbyId}
      <p>
        <strong>Lobby ID:</strong>
        {$joinedLobbyId}
      </p>
    {/if}
    {#if $serverMessage}
      <p><strong>Latest Message:</strong></p>
      <pre>{$serverMessage}</pre>
    {/if}
    {#if $errorMessage}
      <p class="error"><strong>Error:</strong> {$errorMessage}</p>
    {/if}
  </div>
</main>
