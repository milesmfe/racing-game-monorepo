interface ImportMetaEnv {
  readonly VITE_ENV: "development" | "production" | "test";
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
