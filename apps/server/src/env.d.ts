declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: number;
      NODE_ENV: "development" | "production" | "test";
      ALLOWED_ORIGINS?: string;
      MAX_CONNECTIONS: number;
    }
  }
}

export {};
