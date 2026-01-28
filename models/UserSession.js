import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  }, // Only one session per user
  token: { type: String, required: true },
  loginTime: { type: Date, default: Date.now },
  deviceInfo: { type: String }, // Optional: user-agent or IP
});

export default mongoose.model("Session", sessionSchema);
