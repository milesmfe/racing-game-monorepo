<script lang="ts">
  import {
    connected,
    errorMessage,
    serverMessage,
    id,
    joinedLobbyId,
    lobbyList,
    trackList,
    connect,
    disconnect,
    getTrackList,
    createLobby as create,
    joinLobby as join,
    leaveLobby as leave,
    startGame as start,
  } from "@lib/websocket";

  let currentTrackIndex = 0;

  function nextTrack() {
    if ($trackList && currentTrackIndex < $trackList.length - 1) {
      currentTrackIndex++;
    }
  }

  function prevTrack() {
    if (currentTrackIndex > 0) {
      currentTrackIndex--;
    }
  }

  function goToTrack(index: number) {
    currentTrackIndex = index;
  }

  $: if ($trackList) {
    currentTrackIndex = Math.min(currentTrackIndex, $trackList.length);
  }
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
    <button on:click={getTrackList} disabled={!$connected || !!$joinedLobbyId}
      >Get Track List</button
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

  <div class="trackList" hidden={!$connected || !$trackList}>
    <p>
      <strong>Available Tracks:</strong>
    </p>

    <div class="carousel">
      <div
        class="carouselTrack"
        style="transform: translateX(-{currentTrackIndex * 100}%)"
      >
        {#each $trackList as track}
          <div class="track">
            <p class="trackName">
              <strong>{track.name}</strong>
            </p>
            <p class="trackAuthor">by {track.author}</p>
            <p class="trackDescription">"{track.description}"</p>
            <div class="trackContainer">
              {@html track.svg}
            </div>
          </div>
        {/each}
      </div>
    </div>

    {#if $trackList && $trackList.length > 1}
      <div class="carouselControls">
        <button
          class="carouselButton"
          on:click={prevTrack}
          disabled={currentTrackIndex === 0}
        >
          Previous
        </button>
        <span class="carouselIndicator">
          {currentTrackIndex + 1} / {$trackList.length}
        </span>
        <button
          class="carouselButton"
          on:click={nextTrack}
          disabled={currentTrackIndex === $trackList.length - 1}
        >
          Next
        </button>
      </div>

      <div class="carouselDots">
        {#each $trackList as _, index}
          <div
            class="carouselDot"
            class:active={index === currentTrackIndex}
            on:click={() => goToTrack(index)}
            on:keypress={(e) => e.key === "Enter" && goToTrack(index)}
            role="button"
            tabindex="0"
          ></div>
        {/each}
      </div>
    {/if}
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
