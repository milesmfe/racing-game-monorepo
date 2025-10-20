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
      throw new Error(`Game state for ID ${id.value} not found`);
    }
    return this.stateCache.get(id) as GameState;
  }

  public clearState(id: Id): void {
    this.stateCache.delete(id);
  }

  public async handleMessage(clientId: Id, message: WSMessage, ws: WSContext): Promise<void> {
    if (!isGameMessage(message)) return;

    console.log(`GameHandler received message from ${clientId.value}:`, message);

    switch (message.command) {
      case WSGameCommand.ACTION:
        console.log(`Client ${clientId.value} performed an action in game ${message.data?.gameId}`);
        // TODO: Implement game action logic
        break;
    }

    // Temporary test response
    const response = createWSMessage.game(WSGameCommand.ACTION, { gameId: message.data?.gameId });
    ws.send(JSON.stringify(response));
  }

  public async handleDisconnect(clientId: Id, ws: WSContext): Promise<void> {
    // TODO: Implement disconnect logic
    console.log(`Client ${clientId.value} disconnected from game`);
  }
}
