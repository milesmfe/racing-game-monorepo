import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

const VITE_PORT = process.env.VITE_PORT
  ? parseInt(process.env.VITE_PORT)
  : 5173;

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: { port: VITE_PORT },
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "src/lib"),
    },
  },
});
