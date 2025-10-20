import { Id, WSMessage } from "@racing-game-mono/core";
import { WSContext } from "hono/ws";

export interface Handler {
  stateCache: Map<Id, unknown>;
  playerMap: Map<Id, Id>;
  setState(id: Id, state: unknown): void;
  getState(id: Id): unknown;
  clearState(id: Id): void;
  handleMessage(clientId: Id, message: WSMessage, ws: WSContext): Promise<void>;
  handleDisconnect(clientId: Id, ws: WSContext): Promise<void>;
}
