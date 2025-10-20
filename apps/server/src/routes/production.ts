import { Hono } from "hono";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { readFile } from "fs/promises";
import "dotenv/config";

const NODE_ENV = process.env.NODE_ENV || "development";
const production = new Hono();

if (NODE_ENV === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const getContentType = (path: string): string => {
    if (path.endsWith(".js")) return "application/javascript";
    if (path.endsWith(".css")) return "text/css";
    if (path.endsWith(".html")) return "text/html";
    if (path.endsWith(".json")) return "application/json";
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
    if (path.endsWith(".svg")) return "image/svg+xml";
    if (path.endsWith(".woff")) return "font/woff";
    if (path.endsWith(".woff2")) return "font/woff2";
    if (path.endsWith(".ttf")) return "font/ttf";
    return "application/octet-stream";
  };

  production.get("/", async (c) => {
    try {
      const indexHtml = await readFile(
        join(__dirname, "web/dist/index.html"),
        "utf-8"
      );
      return c.html(indexHtml);
    } catch (error) {
      return c.text("Main production not found", 404);
    }
  });

  production.get("/assets/*", async (c) => {
    try {
      const path = c.req.path.replace("/assets/", "");
      const buffer = await readFile(join(__dirname, "web/dist/assets", path));
      const uint8Array = new Uint8Array(buffer);
      const contentType = getContentType(path);
      return c.body(uint8Array, 200, { "Content-Type": contentType });
    } catch (error) {
      return c.text("Asset not found", 404);
    }
  });

  production.get("/track-designer", async (c) => {
    try {
      const indexHtml = await readFile(
        join(__dirname, "track-designer/dist/index.html"),
        "utf-8"
      );
      return c.html(indexHtml);
    } catch (error) {
      return c.text("Track designer production not found", 404);
    }
  });

  production.get("/track-designer/assets/*", async (c) => {
    try {
      const path = c.req.path.replace("/track-designer/assets/", "");
      const buffer = await readFile(
        join(__dirname, "track-designer/dist/assets", path)
      );
      const uint8Array = new Uint8Array(buffer);
      const contentType = getContentType(path);
      return c.body(uint8Array, 200, { "Content-Type": contentType });
    } catch (error) {
      return c.text("Asset not found", 404);
    }
  });
} else {
  production.get("/", (c) => {
    return c.text(`Racing Game Server (${NODE_ENV}) is running.`);
  });
}

export default production;
