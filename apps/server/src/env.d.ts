declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      NODE_ENV?: "development" | "production" | "test";
      ALLOWED_ORIGINS?: string;
      MAX_GAMES?: string;
      INACTIVE_LOBBY_TIMEOUT?: string;
      ADMIN_API_KEY?: string;
    }
  }
}

export {};
