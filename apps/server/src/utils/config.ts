export const config = {
  PORT: Number(process.env.PORT || 3000),
  MAX_CONNECTIONS: Number(process.env.MAX_CONNECTIONS || 100),
  NODE_ENV: process.env.NODE_ENV || "development",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(",") || [],
};
