import {
  Id,
  LobbyState,
  WSMessage,
  WSLobbyCommand,
  isLobbyMessage,
  createWSMessage,
} from "@racing-game-mono/core";
import { Handler } from "./Handler";
import { WSContext } from "hono/ws";

export default class LobbyHandler implements Handler {
  public readonly stateCache: Map<Id, LobbyState>;

  constructor() {
    this.stateCache = new Map<Id, LobbyState>();
  }

  public setState(id: Id, state: LobbyState): void {
    this.stateCache.set(id, state);
  }

  public getState(id: Id): LobbyState {
    if (!this.stateCache.has(id)) {
      throw new Error(`Lobby state for ID ${id.value} not found`);
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

    console.log(
      `LobbyHandler received message from ${clientId.value}:`,
      message
    );

    switch (message.command) {
      case WSLobbyCommand.CREATE:
        console.log(`Client ${clientId.value} is creating a lobby.`);
        // TODO: Implement lobby creation logic
        break;
      case WSLobbyCommand.JOIN:
        console.log(
          `Client ${clientId.value} is joining lobby ${message.data?.lobbyId}`
        );
        // TODO: Implement lobby joining logic
        break;
      case WSLobbyCommand.LEAVE:
        console.log(
          `Client ${clientId.value} is leaving lobby ${message.data?.lobbyId}`
        );
        // TODO: Implement lobby leaving logic
        break;
    }
    // Temporary test response
    const response = createWSMessage.lobby(WSLobbyCommand.CREATE, {
      lobbyId: "new-lobby-123",
    });
    ws.send(JSON.stringify(response));
  }
}
