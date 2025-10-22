import { Id } from "@racing-game-mono/core";
import { WSContext } from "hono/ws";

export class Lobby {
  id: Id;
  hostId: Id;
  players: Map<Id, { ws: WSContext }>;
  maxPlayers: number = 6;

  constructor(id: Id, hostId: Id, hostWs: WSContext) {
    this.id = id;
    this.hostId = hostId;
    this.players = new Map();
    this.players.set(hostId, { ws: hostWs });
    this.addPlayer(hostId, hostWs);
  }

  addPlayer(playerId: Id, playerWs: WSContext): boolean {
    if (this.players.has(playerId)) {
      return false;
    }
    this.players.set(playerId, { ws: playerWs });
    return true;
  }

  isInLobby(playerId: Id): boolean {
    return this.players.has(playerId);
  }

  removePlayer(playerId: Id): boolean {
    return this.players.delete(playerId);
  }

  isHost(playerId: Id): boolean {
    return this.hostId === playerId;
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getMaxPlayers(): number {
    return this.maxPlayers;
  }

  // TODO: Add methods for:
  // Select Track
  // Broadcast state
  // Start game
}
