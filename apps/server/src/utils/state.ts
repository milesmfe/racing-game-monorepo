import { WSContext } from "hono/ws";
import { Id } from "@racing-game-mono/core";
import { Lobby } from "../classes/Lobby";

export const state = {
  connections: new Map<Id, WSContext>(),
  clientIds: new WeakMap<WSContext, Id>(),
  verifiedIds: new Set<Id>(),
  lobbies: new Map<Id, Lobby>(),
};
