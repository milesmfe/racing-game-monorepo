import express, { type Router } from "express";

const router: Router = express.Router();

type EmojiResponse = string[];

router.get<object, EmojiResponse>("/", (req, res) => {
  res.json(["😀", "😳", "🙄"]);
});

export default router;
