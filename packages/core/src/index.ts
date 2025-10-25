import { z } from "zod";

// ----------------------------------------------------------------------------
// State & Identity
// ----------------------------------------------------------------------------
const IdSchema = z.string().length(36);

export type Id = z.infer<typeof IdSchema>;

export function createId(): Id {
  return crypto.randomUUID();
}

const lobbyListSchema = z.array(
  z.object({
    id: IdSchema,
    playerCount: z.number(),
    maxPlayers: z.number(),
  })
);
export type LobbyList = z.infer<typeof lobbyListSchema>;

const trackListSchema = z.array(
  z.object({
    id: IdSchema,
    name: z.string(),
    description: z.string(),
    author: z.string(),
    data: z.object({
      meta: z.object({
        lanes: z.number(),
        segmentsPerLane: z.number(),
        direction: z.string(),
      }),
      segments: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          lane: z.number(),
          index: z.number(),
          data: z.number().nullable(),
          connections: z.object({
            next: z.string().nullable(),
            diag_left: z.string().nullable(),
            diag_right: z.string().nullable(),
          }),
        })
      ),
    }),
    svg: z.string().startsWith("<svg"),
  })
);
export type TrackList = z.infer<typeof trackListSchema>;

// ----------------------------------------------------------------------------
// WebSocket Messaging
// ----------------------------------------------------------------------------
export enum WSProtocol {
  CONNECT = "connect",
  RECONNECT = "reconnect",
  GET_LOBBY_LIST = "get_lobby_list",
  CREATE_LOBBY = "create_lobby",
  JOIN_LOBBY = "join_lobby",
  LEAVE_LOBBY = "leave_lobby",
  START_GAME = "start_game",
  GET_TRACK_LIST = "get_track_list",
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

const clientGetLobbyListMessageSchema = z.object({
  protocol: z.literal(WSProtocol.GET_LOBBY_LIST),
});
export type ClientGetLobbyListMessage = z.infer<
  typeof clientGetLobbyListMessageSchema
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
  id: IdSchema,
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

const clientGetTrackListSchema = z.object({
  protocol: z.literal(WSProtocol.GET_TRACK_LIST),
});
export type ClientGetTrackList = z.infer<typeof clientGetTrackListSchema>;

const clientMessageSchena = z.discriminatedUnion("protocol", [
  clientConnectMessageSchema,
  clientReconnectMessageSchema,
  clientGetLobbyListMessageSchema,
  clientCreateLobbyMessageSchema,
  clientJoinLobbyMessageSchema,
  clientLeaveLobbyMessageSchema,
  clientStartGameMessageSchema,
  clientGetTrackListSchema,
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

export const serverGetLobbyListMessageSchema = z.discriminatedUnion("success", [
  z.object({
    protocol: z.literal(WSProtocol.GET_LOBBY_LIST),
    success: z.literal(true),
    lobbyList: lobbyListSchema,
  }),
  z.object({
    protocol: z.literal(WSProtocol.GET_LOBBY_LIST),
    success: z.literal(false),
    error: z.string(),
  }),
]);
export type ServerGetLobbyListMessage = z.infer<
  typeof serverGetLobbyListMessageSchema
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

const serverGetTrackListSchema = z.discriminatedUnion("success", [
  z.object({
    protocol: z.literal(WSProtocol.GET_TRACK_LIST),
    success: z.literal(true),
    trackList: trackListSchema,
  }),
  z.object({
    protocol: z.literal(WSProtocol.GET_TRACK_LIST),
    success: z.literal(false),
    error: z.string(),
  }),
]);
export type ServerGetTrackList = z.infer<typeof serverGetTrackListSchema>;

const serverMessageSchema = z.discriminatedUnion("protocol", [
  serverConnectMessageSchema,
  serverReconnectMessageSchema,
  serverGetLobbyListMessageSchema,
  serverCreateLobbyMessageSchema,
  serverJoinLobbyMessageSchema,
  serverLeaveLobbyMessageSchema,
  serverStartGameMessageSchema,
  serverGetTrackListSchema,
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;

export function parseClientMessage(data: unknown): ClientMessage {
  return clientMessageSchena.parse(data);
}

export function parseServerMessage(data: unknown): ServerMessage {
  return serverMessageSchema.parse(data);
}
