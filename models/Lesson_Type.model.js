import mongoose from "mongoose";

const lessonTypeSchema = new mongoose.Schema(
  {
    lesson_type: {
      type: String,
      required: true,
      unique: true,
      enum: ["video", "pdf", "quiz", "live", "assignment", "text", "playground", "link", "ppt"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Lesson_Type = mongoose.model("Lesson_Type", lessonTypeSchema);

export default Lesson_Type;
