import express from "express";
import VideoHandler from "../handlers/videoHandler.js";

const router = express.Router();
const videoHandler = new VideoHandler();

router.post("/merge-chunks", (req, res) => {
  console.log("📹 Merge API call received");
  videoHandler.handle(req, res);
});

export default router;