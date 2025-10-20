import {
  GameState,
  Id,
  WSMessage,
  WSGameCommand,
  isGameMessage,
  createWSMessage,
} from "@racing-game-mono/core";
import { Handler } from "./Handler";
import { WSContext } from "hono/ws";

export default class GameHandler implements Handler {
  public readonly stateCache: Map<Id, GameState>;
  public readonly playerMap: Map<Id, Id>;

  constructor() {
    this.stateCache = new Map<Id, GameState>();
    this.playerMap = new Map<Id, Id>();
  }

  public setState(id: Id, state: GameState): void {
    this.stateCache.set(id, state);
  }

  public getState(id: Id): GameState {
    if (!this.stateCache.has(id)) {
      throw new Error(`Game state for ID ${id} not found`);
    }
    return this.stateCache.get(id) as GameState;
  }

  public clearState(id: Id): void {
    this.stateCache.delete(id);
  }

  public async handleMessage(
    clientId: Id,
    message: WSMessage,
    ws: WSContext
  ): Promise<void> {
    if (!isGameMessage(message)) return;

    console.log(`GameHandler received message from ${clientId}:`, message);

    switch (message.command) {
      case WSGameCommand.ACTION:
        console.log(
          `Client ${clientId} performed an action in game ${message.data?.gameId}`
        );
        // TODO: Implement game action logic
        break;
    }
  }

  public getPlayerGameId(clientId: Id): Id | undefined {
    return this.playerMap.get(clientId);
  }

  public async handleDisconnect(clientId: Id): Promise<void> {
    const gameId = this.playerMap.get(clientId);
    if (gameId) {
      console.log(`Client ${clientId} disconnected from game ${gameId}`);
      // TODO: Implement logic to handle player disconnects during a game.
    }
  }
}
