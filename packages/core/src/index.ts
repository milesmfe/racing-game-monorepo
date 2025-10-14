export interface Player {
  id: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}

export interface GameState {
  players: Map<string, Player>;
  timestamp: number;
}

export type WSMessage =
  | { type: "join"; playerId: string }
  | { type: "update"; position: { x: number; y: number } }
  | { type: "leave"; playerId: string };
