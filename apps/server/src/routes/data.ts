import { Hono } from "hono";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const data = new Hono();

data.get("/tracks", async (c) => {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const tracksDir = join(__dirname, "data/tracks");

    const { readdir, readFile } = await import("fs/promises");
    const entries = await readdir(tracksDir, { withFileTypes: true });

    const tracks = await Promise.all(
      entries
        .filter((dirent) => dirent.isDirectory())
        .map(async (dirent) => {
          const folderName = dirent.name;
          const folderPath = join(tracksDir, folderName);

          const files = await readdir(folderPath);
          const jsonFile = files.find((f) => f.toLowerCase().endsWith(".json"));
          const svgFile = files.find((f) => f.toLowerCase().endsWith(".svg"));

          if (!jsonFile) return null;

          const jsonRaw = await readFile(join(folderPath, jsonFile), "utf-8");
          const data = JSON.parse(jsonRaw);

          let svg: string | null = null;
          if (svgFile) {
            svg = await readFile(join(folderPath, svgFile), "utf-8");
          }
          return {
            name: folderName,
            data,
            svg,
          };
        })
    );

    return c.json(tracks.filter(Boolean));
  } catch (error) {
    console.error("Failed to load tracks:", error);
    return c.json({ error: "Failed to load tracks" }, 500);
  }
});

data.get("/tracks/:trackName", async (c) => {
  try {
    const trackName = c.req.param("trackName");
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const trackDir = join(__dirname, "data/tracks", trackName);

    const { readdir, readFile } = await import("fs/promises");
    const files = await readdir(trackDir);
    const jsonFile = files.find((f) => f.toLowerCase().endsWith(".json"));
    const svgFile = files.find((f) => f.toLowerCase().endsWith(".svg"));

    if (!jsonFile) {
      return c.json({ error: "Track not found" }, 404);
    }
    const jsonRaw = await readFile(join(trackDir, jsonFile), "utf-8");
    const data = JSON.parse(jsonRaw);

    let svg: string | null = null;
    if (svgFile) {
      svg = await readFile(join(trackDir, svgFile), "utf-8");
    }

    return c.json({ name: trackName, data, svg });
  } catch (error) {
    console.error("Failed to load track:", error);
    return c.json({ error: "Failed to load track" }, 500);
  }
});

export default data;
