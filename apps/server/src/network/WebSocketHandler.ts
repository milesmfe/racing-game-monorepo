import { WebSocket } from "ws";
import { GameManager } from "@racing-game-mono/server/game/GameManager.js";
import { AnyGameCommand } from "@racing-game-mono/core";

const gameManager = new GameManager();

export const handleConnection = (ws: WebSocket) => {
  const playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`Player ${playerId} assigned.`);

  const gameId = "default_lobby";
  gameManager.addPlayerToGame(gameId, playerId, ws);

  ws.on("message", (message) => {
    try {
      const command = JSON.parse(message.toString()) as AnyGameCommand;
      console.log(`Received command from ${playerId}:`, command.type);
      gameManager.handleCommand(gameId, playerId, command);
    } catch (error) {
      console.error(`Error processing message from ${playerId}:`, error);
      ws.send(
        JSON.stringify({
          type: "ERROR",
          payload: { message: "Invalid command format." },
        })
      );
    }
  });
};
