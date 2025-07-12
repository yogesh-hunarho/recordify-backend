import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";

import uploadRoutes from "./routes/upload.js";
import listVideosRoute from "./routes/list-videos.js";


const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", uploadRoutes);
app.use("/api", listVideosRoute);

app.get("/", (_req, res) => {
  res.send("recordify Uploader API Running!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀  Server running on http://localhost:${PORT}`)
);
