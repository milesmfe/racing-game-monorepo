import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { config } from "./config";
import { setupWebSocket } from "./websocket";

const app = new Hono();

app.use("/*", cors({ origin: config.ALLOWED_ORIGINS }));

const { injectWebSocket } = setupWebSocket(app);

if (config.NODE_ENV === "production") {
  // TODO: Implement frontend serving
} else {
  app.get("/", (c) =>
    c.json({ message: "Racing Game Server", env: config.NODE_ENV })
  );
}

const server = serve({ fetch: app.fetch, port: config.PORT });
injectWebSocket(server);
console.log(`Server running on http://localhost:${config.PORT}`);
