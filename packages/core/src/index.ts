import { z } from "zod";

// ----------------------------------------------------------------------------
// Shared Schemas and Types
// ----------------------------------------------------------------------------
export const IdSchema = z.string().min(1);
export type Id = z.infer<typeof IdSchema>;

export const PlayerSchema = z.object({
  id: z.number(),
  name: z.string(),
  roll: z.number(),
  rollOrder: z.number(),
  currentPosition: z.object({ i: z.number(), j: z.number() }),
  currentSpeed: z.number(),
  brakeWear: z.number(),
  tyreWear: z.number(),
  lapsRemaining: z.number(),
  spunOff: z.boolean(),
  isPlayer: z.boolean(),
  socketId: z.string(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const LobbyState = z.object({
  roomName: z.string(),
  players: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      isPlayer: z.boolean(),
    })
  ),
  phase: z.enum(["initial", "in-room"]),
});
export type LobbyState = z.infer<typeof LobbyState>;

export const GameState = z.object({
  players: z.array(PlayerSchema),
  numLaps: z.number(),
  finishedPlayerIds: z.array(z.string()),
  lastPlayerId: z.string().nullable(),
  raceOverTriggered: z.boolean(),
  phase: z.enum([
    "speedselect",
    "moving",
    "penalty",
    "turn-over",
    "finished",
    "waiting",
  ]),
  currentPlayerIndex: z.number(),
  requiredSteps: z.number(),
  die1Result: z.number().nullable(),
  die2Result: z.number().nullable(),
  winnerData: z.object({ id: z.number(), name: z.string() }).nullable(),
  podiumData: z.array(z.object({ id: z.number(), name: z.string() })),
});
export type GameState = z.infer<typeof GameState>;

// ----------------------------------------------------------------------------
// Shared WebSocket Message Schemas and Types
// ----------------------------------------------------------------------------

export enum WSMessageTarget {
  CONNECT = "connect",
  LOBBY = "lobby",
  GAME = "game",
  ERROR = "error",
}
export enum WSConnectCommand {
  WELCOME = "welcome",
  WELCOME_BACK = "welcome-back",
  HELLO = "hello",
  RECONNECT = "reconnect",
}
export enum WSLobbyCommand {
  CREATE = "create",
  JOIN = "join",
  LEAVE = "leave",
}
export enum WSGameCommand {
  ACTION = "action",
}

const connectDataSchema = z.object({ clientId: z.string() });
const lobbyDataSchema = z.object({ lobbyId: z.string().optional() });
const gameDataSchema = z.object({ gameId: z.string().optional() });

const connectMessageSchema = z.object({
  target: z.literal(WSMessageTarget.CONNECT),
  command: z.enum(WSConnectCommand),
  data: connectDataSchema.optional(),
});
export type WSConnectMessage = z.infer<typeof connectMessageSchema>;

const lobbyMessageSchema = z.object({
  target: z.literal(WSMessageTarget.LOBBY),
  command: z.enum(WSLobbyCommand),
  data: lobbyDataSchema.optional(),
});
export type WSLobbyMessage = z.infer<typeof lobbyMessageSchema>;

const gameMessageSchema = z.object({
  target: z.literal(WSMessageTarget.GAME),
  command: z.enum(WSGameCommand),
  data: gameDataSchema.optional(),
});
export type WSGameMessage = z.infer<typeof gameMessageSchema>;

const errorMessageSchema = z.object({
  target: z.literal(WSMessageTarget.ERROR),
  data: z.object({ message: z.string() }),
});
export type WSErrorMessage = z.infer<typeof errorMessageSchema>;

export const wsMessageSchema = z.discriminatedUnion("target", [
  connectMessageSchema,
  lobbyMessageSchema,
  gameMessageSchema,
  errorMessageSchema,
]);
export type WSMessage = z.infer<typeof wsMessageSchema>;

// ----------------------------------------------------------------------------
// Shared Factory and Type Guard Functions
// ----------------------------------------------------------------------------
export const createId = (): Id => {
  return crypto.randomUUID();
};

export const createWSMessage = {
  connect: (
    command: WSConnectCommand,
    data?: z.infer<typeof connectDataSchema>
  ): WSConnectMessage => ({
    target: WSMessageTarget.CONNECT,
    command,
    data,
  }),
  lobby: (
    command: WSLobbyCommand,
    data?: z.infer<typeof lobbyDataSchema>
  ): WSLobbyMessage => ({
    target: WSMessageTarget.LOBBY,
    command,
    data,
  }),
  game: (
    command: WSGameCommand,
    data?: z.infer<typeof gameDataSchema>
  ): WSGameMessage => ({
    target: WSMessageTarget.GAME,
    command,
    data,
  }),
  error: (message: string): WSErrorMessage => ({
    target: WSMessageTarget.ERROR,
    data: { message },
  }),
};

export function parseWSMessage(data: unknown): WSMessage | null {
  const result = wsMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

export const isConnectMessage = (msg: WSMessage): msg is WSConnectMessage =>
  msg.target === WSMessageTarget.CONNECT;
export const isLobbyMessage = (msg: WSMessage): msg is WSLobbyMessage =>
  msg.target === WSMessageTarget.LOBBY;
export const isGameMessage = (msg: WSMessage): msg is WSGameMessage =>
  msg.target === WSMessageTarget.GAME;
export const isErrorMessage = (msg: WSMessage): msg is WSErrorMessage =>
  msg.target === WSMessageTarget.ERROR;
