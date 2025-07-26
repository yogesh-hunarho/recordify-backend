import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import path from "path";
import mongoose from 'mongoose'

import uploadRoutes from "./routes/upload.js";
import listVideosRoute from "./routes/list-videos.js";
import userSettingsRoutes from "./routes/user-settings.js";
import feedbackRoutes from "./routes/feedback.js";
// import FixWebmVideo from "./routes/fix-video.js"

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"))
// app.use("/api/fixed-uploads", express.static(path.join("fixed-uploads")));

app.use("/api", uploadRoutes);
app.use("/api", listVideosRoute);
app.use("/api", userSettingsRoutes);
app.use("/api", feedbackRoutes);
// app.use("/api", FixWebmVideo);

app.get("/", (_req, res) => {
  res.send("recordify Uploader API Running!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀  Server running on http://localhost:${PORT}`)
);
