import { WebSocket } from "ws";
import { GameState } from "@racing-game-mono/server/game/GameState.js";
import { AnyGameCommand } from "@racing-game-mono/core";

export class GameManager {
  private games: Map<string, GameState> = new Map();

  addPlayerToGame(gameId: string, playerId: string, ws: WebSocket) {
    let gameState = this.games.get(gameId);

    if (!gameState) {
      console.log(`Creating new game with ID: ${gameId}`);
      gameState = new GameState(gameId, this.onGameEnd.bind(this));
      this.games.set(gameId, gameState);
    }

    gameState.addPlayer(playerId, ws);
  }

  handleCommand(gameId: string, playerId: string, command: AnyGameCommand) {
    const gameState = this.games.get(gameId);
    if (gameState) {
      gameState.handleCommand(playerId, command);
    } else {
      console.warn(`Game not found for ID: ${gameId}`);
    }
  }

  private onGameEnd(gameId: string) {
    console.log(`Game ${gameId} has ended. Removing from manager.`);
    this.games.delete(gameId);
  }
}
