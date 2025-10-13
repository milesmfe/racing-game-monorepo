import { WebSocket } from "ws";
import { AnyGameCommand, MovePiecePayload } from "@racing-game-mono/core";

enum GamePhase {
  WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS",
  IN_PROGRESS = "IN_PROGRESS",
  GAME_OVER = "GAME_OVER",
}

export class GameState {
  private players: Map<string, WebSocket> = new Map();
  private board: object = {}; // Represents the board state
  private currentPlayer: string | null = null;
  private phase: GamePhase = GamePhase.WAITING_FOR_PLAYERS;

  constructor(
    private gameId: string,
    private onGameEnd: (gameId: string) => void
  ) {
    console.log(`Game ${this.gameId} is ${this.phase}.`);
  }

  addPlayer(playerId: string, ws: WebSocket) {
    if (this.players.has(playerId)) {
      console.warn(`Player ${playerId} already in game ${this.gameId}.`);
      return;
    }
    this.players.set(playerId, ws);
    console.log(
      `Player ${playerId} joined game ${this.gameId}. Total players: ${this.players.size}`
    );

    ws.on("close", () => {
      this.removePlayer(playerId);
    });

    if (
      this.players.size === 2 &&
      this.phase === GamePhase.WAITING_FOR_PLAYERS
    ) {
      this.startGame();
    }

    this.broadcastGameState();
  }

  removePlayer(playerId: string) {
    this.players.delete(playerId);
    console.log(
      `Player ${playerId} left game ${this.gameId}. Total players: ${this.players.size}`
    );

    if (this.phase === GamePhase.IN_PROGRESS && this.players.size < 2) {
      this.phase = GamePhase.GAME_OVER;
      console.log(
        `Game ${this.gameId} is ${this.phase} due to player leaving.`
      );
    }

    if (this.players.size === 0) {
      this.onGameEnd(this.gameId);
    } else {
      this.broadcastGameState();
    }
  }

  private startGame() {
    this.phase = GamePhase.IN_PROGRESS;
    const playerIds = [...this.players.keys()];
    this.currentPlayer = playerIds[0]; // First player to join goes first
    console.log(
      `Game ${this.gameId} has started. Current turn: ${this.currentPlayer}`
    );
    this.broadcastGameState();
  }

  handleCommand(playerId: string, command: AnyGameCommand) {
    if (this.phase !== GamePhase.IN_PROGRESS) {
      return this.sendError(playerId, "Game is not in progress.");
    }
    if (playerId !== this.currentPlayer) {
      return this.sendError(playerId, "It is not your turn.");
    }

    switch (command.type) {
      case "MOVE_PIECE":
        this.executeMovePiece(playerId, command.payload);
        break;
      case "END_TURN":
        this.executeEndTurn(playerId);
        break;
      default:
        this.sendError(playerId, `Unknown command type.`);
    }
  }

  private executeMovePiece(playerId: string, payload: MovePiecePayload) {
    console.log(
      `Player ${playerId} is moving piece ${payload.pieceId} from ${payload.from} to ${payload.to}`
    );
    // TODO: Implement move validation and update this.board
    this.broadcastGameState();
  }

  private executeEndTurn(playerId: string) {
    const playerIds = [...this.players.keys()];
    const currentIndex = playerIds.indexOf(playerId);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    this.currentPlayer = playerIds[nextIndex];
    console.log(
      `Player ${playerId} ended their turn. New turn: ${this.currentPlayer}`
    );
    this.broadcastGameState();
  }

  private sendError(playerId: string, errorMessage: string) {
    const ws = this.players.get(playerId);
    if (ws) {
      ws.send(
        JSON.stringify({ type: "ERROR", payload: { message: errorMessage } })
      );
    }
  }

  private broadcastGameState() {
    const statePayload = {
      gameId: this.gameId,
      phase: this.phase,
      players: [...this.players.keys()],
      currentPlayer: this.currentPlayer,
      board: this.board,
    };

    const message = JSON.stringify({
      type: "GAME_STATE_UPDATE",
      payload: statePayload,
    });

    this.players.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}
