import { Router } from "express";
import { getPresignedUrl } from "../utils/s3.js";

const router = Router();

router.post("/presigned-url", async (req, res) => {
  const { filename, contentType } = req.body;

  if (!filename || !contentType)
    return res.status(400).json({ error: "Filename and contentType are required" });

  try {
    const { url, key } = await getPresignedUrl(filename, contentType);
    res.json({ url, key });
  } catch (err) {
    console.error("Presign error:", err);
    res.status(500).json({ error: "Failed to generate URL" });
  }
});

export default router;