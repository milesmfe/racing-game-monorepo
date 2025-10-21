import { z } from "zod";

// ----------------------------------------------------------------------------
// State & Identity
// ----------------------------------------------------------------------------
const IdSchema = z.string().length(36);

export type Id = z.infer<typeof IdSchema>;

export function createId(): Id {
  return crypto.randomUUID();
}

// ----------------------------------------------------------------------------
// WebSocket Messaging
// ----------------------------------------------------------------------------
export enum WSProtocol {
  CONNECT = "connect",
  RECONNECT = "reconnect",
  CREATE_LOBBY = "create_lobby",
  JOIN_LOBBY = "join_lobby",
  LEAVE_LOBBY = "leave_lobby",
  START_GAME = "start_game",
}

const clientConnectMessageSchema = z.object({
  protocol: z.literal(WSProtocol.CONNECT),
});
export type ClientConnectMessage = z.infer<typeof clientConnectMessageSchema>;

const clientReconnectMessageSchema = z.object({
  protocol: z.literal(WSProtocol.RECONNECT),
  id: IdSchema,
});
export type ClientReconnectMessage = z.infer<
  typeof clientReconnectMessageSchema
>;

const clientCreateLobbyMessageSchema = z.object({
  protocol: z.literal(WSProtocol.CREATE_LOBBY),
});
export type ClientCreateLobbyMessage = z.infer<
  typeof clientCreateLobbyMessageSchema
>;

const clientJoinLobbyMessageSchema = z.object({
  protocol: z.literal(WSProtocol.JOIN_LOBBY),
  id: IdSchema,
});
export type ClientJoinLobbyMessage = z.infer<
  typeof clientJoinLobbyMessageSchema
>;

const clientLeaveLobbyMessageSchema = z.object({
  protocol: z.literal(WSProtocol.LEAVE_LOBBY),
});
export type ClientLeaveLobbyMessage = z.infer<
  typeof clientLeaveLobbyMessageSchema
>;

const clientStartGameMessageSchema = z.object({
  protocol: z.literal(WSProtocol.START_GAME),
});
export type ClientStartGameMessage = z.infer<
  typeof clientStartGameMessageSchema
>;

const clientMessageSchena = z.discriminatedUnion("protocol", [
  clientConnectMessageSchema,
  clientReconnectMessageSchema,
  clientCreateLobbyMessageSchema,
  clientJoinLobbyMessageSchema,
  clientLeaveLobbyMessageSchema,
  clientStartGameMessageSchema,
]);
export type ClientMessage = z.infer<typeof clientMessageSchena>;

const serverConnectMessageSchema = z.discriminatedUnion("success", [
  z.object({
    protocol: z.literal(WSProtocol.CONNECT),
    success: z.literal(true),
    id: IdSchema,
  }),
  z.object({
    protocol: z.literal(WSProtocol.CONNECT),
    success: z.literal(false),
    error: z.string(),
  }),
]);
export type ServerConnectMessage = z.infer<typeof serverConnectMessageSchema>;

const serverReconnectMessageSchema = z.discriminatedUnion("success", [
  z.object({
    protocol: z.literal(WSProtocol.RECONNECT),
    success: z.literal(true),
    id: IdSchema,
  }),
  z.object({
    protocol: z.literal(WSProtocol.RECONNECT),
    success: z.literal(false),
    error: z.string(),
  }),
]);
export type ServerReconnectMessage = z.infer<
  typeof serverReconnectMessageSchema
>;

const serverCreateLobbyMessageSchema = z.discriminatedUnion("success", [
  z.object({
    protocol: z.literal(WSProtocol.CREATE_LOBBY),
    success: z.literal(true),
    id: IdSchema,
  }),
  z.object({
    protocol: z.literal(WSProtocol.CREATE_LOBBY),
    success: z.literal(false),
    error: z.string(),
  }),
]);
export type ServerCreateLobbyMessage = z.infer<
  typeof serverCreateLobbyMessageSchema
>;

const serverJoinLobbyMessageSchema = z.discriminatedUnion("success", [
  z.object({
    protocol: z.literal(WSProtocol.JOIN_LOBBY),
    success: z.literal(true),
    id: IdSchema,
  }),
  z.object({
    protocol: z.literal(WSProtocol.JOIN_LOBBY),
    success: z.literal(false),
    error: z.string(),
  }),
]);
export type ServerJoinLobbyMessage = z.infer<
  typeof serverJoinLobbyMessageSchema
>;

const serverLeaveLobbyMessageSchema = z.discriminatedUnion("success", [
  z.object({
    protocol: z.literal(WSProtocol.LEAVE_LOBBY),
    success: z.literal(true),
  }),
  z.object({
    protocol: z.literal(WSProtocol.LEAVE_LOBBY),
    success: z.literal(false),
    error: z.string(),
  }),
]);
export type ServerLeaveLobbyMessage = z.infer<
  typeof serverLeaveLobbyMessageSchema
>;

const serverStartGameMessageSchema = z.discriminatedUnion("success", [
  z.object({
    protocol: z.literal(WSProtocol.START_GAME),
    success: z.literal(true),
  }),
  z.object({
    protocol: z.literal(WSProtocol.START_GAME),
    success: z.literal(false),
    error: z.string(),
  }),
]);
export type ServerStartGameMessage = z.infer<
  typeof serverStartGameMessageSchema
>;

const serverMessageSchema = z.discriminatedUnion("protocol", [
  serverConnectMessageSchema,
  serverReconnectMessageSchema,
  serverCreateLobbyMessageSchema,
  serverJoinLobbyMessageSchema,
  serverLeaveLobbyMessageSchema,
  serverStartGameMessageSchema,
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;

export function parseClientMessage(data: unknown): ClientMessage {
  return clientMessageSchena.parse(data);
}

export function parseServerMessage(data: unknown): ServerMessage {
  return serverMessageSchema.parse(data);
}
