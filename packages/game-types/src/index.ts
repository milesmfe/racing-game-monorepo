export interface Player {
  id: string;
  name: string;
}

export interface GameState {
  players: Player;
}

export interface ServerToClientEvents {
  gameStateUpdate: (state: GameState) => void;
}

export interface ClientToServerEvents {
  joinGame: (gameId: string) => void;
}
