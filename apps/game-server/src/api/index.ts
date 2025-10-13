import express, { type Router } from "express";

import type MessageResponse from "../interfaces/message-response.js";

import emojis from "@repo/game-server/api/emojis.js";

const router: Router = express.Router();

router.get<object, MessageResponse>("/", (req, res) => {
  res.json({
    message: "API - 👋🌎🌍🌏",
  });
});

router.use("/emojis", emojis);

export default router;
