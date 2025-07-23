import express from "express";
import Feedback from "../models/Feedback.js";

const router = express.Router();

router.post("/feedback", async (req, res) => {
  try {
    const { reasons, improvements, email } = req.body;
    const newFeedback = new Feedback({ reasons, improvements, email });
    await newFeedback.save();
    res.status(201).json({ message: "Feedback submitted!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

export default router;
