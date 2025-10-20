import {
  Id,
  LobbyState,
  WSMessage,
  WSLobbyCommand,
  isLobbyMessage,
  createWSMessage,
  createId,
} from "@racing-game-mono/core";
import { Handler } from "./Handler";
import { WSContext } from "hono/ws";

export default class LobbyHandler implements Handler {
  public readonly stateCache: Map<Id, LobbyState>;
  public readonly playerMap: Map<Id, Id>;

  constructor() {
    this.stateCache = new Map<Id, LobbyState>();
    this.playerMap = new Map<Id, Id>();
  }

  public setState(id: Id, state: LobbyState): void {
    this.stateCache.set(id, state);
  }

  public getState(id: Id): LobbyState {
    if (!this.stateCache.has(id)) {
      throw new Error(`Lobby state for ID ${id} not found`);
    }
    return this.stateCache.get(id) as LobbyState;
  }

  public clearState(id: Id): void {
    this.stateCache.delete(id);
  }

  public async handleMessage(
    clientId: Id,
    message: WSMessage,
    ws: WSContext
  ): Promise<void> {
    if (!isLobbyMessage(message)) return;

    console.log(`LobbyHandler received message from ${clientId}:`, message);

    switch (message.command) {
      case WSLobbyCommand.CREATE:
        const newLobbyId = createId();
        const newLobby: LobbyState = {
          roomName: "New Lobby",
          players: [{ id: clientId, name: "Player 1", isPlayer: true }],
          phase: "in-room",
        };

        this.setState(newLobbyId, newLobby);
        this.playerMap.set(clientId, newLobbyId);

        console.log(`Client ${clientId} created lobby ${newLobbyId}`);

        const response = createWSMessage.lobby(WSLobbyCommand.CREATE, {
          lobbyId: newLobbyId,
        });
        ws.send(JSON.stringify(response));
        break;

      case WSLobbyCommand.JOIN:
        console.log(
          `Client ${clientId} is joining lobby ${message.data?.lobbyId}`
        );
        // TODO: Implement lobby joining logic
        break;

      case WSLobbyCommand.LEAVE:
        console.log(
          `Client ${clientId} is leaving lobby ${message.data?.lobbyId}`
        );
        // TODO: Implement lobby leaving logic
        break;
    }
  }

  public getPlayerLobbyId(clientId: Id): Id | undefined {
    return this.playerMap.get(clientId);
  }

  public async handleDisconnect(clientId: Id): Promise<void> {
    const lobbyId = this.playerMap.get(clientId);
    if (lobbyId) {
      const lobby = this.getState(lobbyId);
      if (lobby) {
        lobby.players = lobby.players.filter((p) => p.id !== clientId);
        this.setState(lobbyId, lobby);
        console.log(`Client ${clientId} removed from lobby ${lobbyId}`);
      }
    }
  }
}
