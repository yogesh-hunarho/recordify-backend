
import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

router.delete("/delete-chunks", express.json(), (req, res) => {
  const { batchId, batchSessionId, teacherId } = req.body;

  if (!batchId || !batchSessionId || !teacherId) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const chunkDir = path.join("uploads/chunks", batchId, batchSessionId, teacherId);

  if (!fs.existsSync(chunkDir)) {
    return res.status(404).json({ error: "Directory not found" });
  }

  try {
    fs.rmSync(chunkDir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting directory:", err);
    res.status(500).json({ error: "Failed to delete chunks" });
  }
});

export default router;