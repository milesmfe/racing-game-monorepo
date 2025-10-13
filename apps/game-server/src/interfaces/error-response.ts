import type MessageResponse from "@repo/game-server/interfaces/message-response.js";

type ErrorResponse = {
  stack?: string;
} & MessageResponse;
export default ErrorResponse;
