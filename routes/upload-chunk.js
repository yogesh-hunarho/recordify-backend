import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const router = express.Router();
const upload = multer({ dest: "uploads/tmp/" });

router.post("/upload-chunk", upload.single("chunk"), (req, res) => {
  const { batchSessionId, batchId, index, teacherId, isLast } = req.body;
  const file = req.file;

  if (!batchId || !teacherId || !batchSessionId || !file) {
    return res.status(400).json({ error: "Missing batchId, teacherId, batchSessionId or file" });
  }

  const chunkDir = path.join("uploads/chunks", batchId, batchSessionId, teacherId);

  fs.mkdirSync(chunkDir, { recursive: true });

  const destPath = path.join(chunkDir, `chunk_${index}.webm`);

  fs.rename(file.path, destPath, async(err) => {
    if (err) {
      console.error("Error saving chunk:", err);
      return res.status(500).json({ error: "Failed to save chunk" });
    }

    console.log(`Chunk ${index} saved at ${destPath}`);

    if(isLast === "true" || isLast === true){
      try {
        const mergeRes = await fetch("http://172.16.0.220:8080/api/merge-chunks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSessionId, batchId, teacherId }),
        });

        const mergeData = await mergeRes.json();
        console.log("Merge result:", mergeData);
      } catch (mergeErr) {
        console.error("Error calling merge API:", mergeErr);
      }
    }
    res.json({ success: true });
  });
});

export default router;

