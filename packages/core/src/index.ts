// A generic command structure that clients will send
export interface GameCommand<T extends string, P> {
  type: T;
  payload: P;
}

// Specific command types and their expected payloads
export type MovePiecePayload = { from: string; to: string; pieceId: string };
export type EndTurnPayload = {}; // No payload needed for ending a turn

export type MovePieceCommand = GameCommand<"MOVE_PIECE", MovePiecePayload>;
export type EndTurnCommand = GameCommand<"END_TURN", EndTurnPayload>;

// A union type representing all possible commands in the game
export type AnyGameCommand = MovePieceCommand | EndTurnCommand;
