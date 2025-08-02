import mongoose from "mongoose";

const RecordingSchema = new mongoose.Schema({
  batchSessionId:Number,
  batchId: Number,
  teacherId:Number,
  videoUrl: String,
  duration:Number,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Recording", RecordingSchema);
