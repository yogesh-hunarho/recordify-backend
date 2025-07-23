import express from "express";
import UserSettings from "../models/UserSettings.js";

const router = express.Router();

router.post("/send-me-details", async (req, res) => {
  try {
    const newSettings = new UserSettings(req.body);
    await newSettings.save();
    res.status(201).json({ message: "Settings saved", data: newSettings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
