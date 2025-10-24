import { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";
import {
  ClientMessage,
  ServerConnectMessage,
  WSProtocol,
  parseClientMessage,
} from "@racing-game-mono/core";
import { state } from "./state";
import { config } from "./config";
import { send, closeWithError } from "./messaging";
import { handleConnect, handleReconnect } from "../handlers/handshake";
import { handlers } from "../handlers/messages";

export const setupWebSocket = (app: Hono) => {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get(
    "/ws",
    upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        if (state.connections.size >= config.MAX_CONNECTIONS) {
          closeWithError(ws, 1001, "Server full");
        }
      },

      onMessage(event, ws) {
        let message: ClientMessage;
        try {
          message = parseClientMessage(JSON.parse(event.data.toString()));
        } catch {
          return closeWithError(ws, 1003, "Invalid message");
        }

        const clientId = state.clientIds.get(ws);

        if (!clientId) {
          if (message.protocol === WSProtocol.CONNECT) return handleConnect(ws);
          if (message.protocol === WSProtocol.RECONNECT)
            return handleReconnect(message, ws);

          const res: ServerConnectMessage = {
            protocol: WSProtocol.CONNECT,
            success: false,
            error: "First message must be CONNECT",
          };
          send(ws, res);
          return closeWithError(ws, 1008, "First message must be CONNECT");
        }

        handlers[message.protocol]?.(message, ws, clientId);
      },

      onClose(event, ws) {
        const clientId = state.clientIds.get(ws);
        if (!clientId) return;

        state.connections.delete(clientId);
        state.clientIds.delete(ws);
        console.log(
          `Client ${clientId} disconnected (${state.connections.size}/${config.MAX_CONNECTIONS})`,
          event.reason ? `\n\tReason: ${event.reason}` : ""
        );
      },
    }))
  );

  return { injectWebSocket };
};
