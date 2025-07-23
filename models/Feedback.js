import mongoose from "mongoose";

const FeedbackSchema = new mongoose.Schema({
  reasons: [String],
  improvements: String,
  email: String,
}, { timestamps: true });

export default mongoose.model("Feedback", FeedbackSchema);
