import { Router } from "express";
import { getPresignedUrl } from "../utils/s3.js";

const router = Router();

router.post("/presigned-url", async (req, res) => {
  const { filename } = req.body;

  if (!filename)
    return res.status(400).json({ error: "Filename is required" });

  const targetFolder = `recording-videos/${new Date().toISOString().split('T')[0]}`;
  const ext = filename.split(".").pop().toLowerCase();
  const contentType = ext === "mp4" ? "video/mp4" : "video/webm";

  try {
    const { url, key } = await getPresignedUrl(filename, contentType, targetFolder);
    console.log("url, key 🤦‍♂️",{url,key})
    res.json({ url, key });
  } catch (err) {
    console.error("Presign error:", err);
    res.status(500).json({ error: "Failed to generate URL" });
  }
});

export default router;
