import mongoose from "mongoose";

const quizSchema = new mongoose.Schema(
  {
    course_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    module_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    pass_percentage: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
      max: 100,
    },
    time_limit_minutes: {
      type: Number,
      required: true,
      min: 1,
    },
    attempts_allowed: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);
const Quiz = mongoose.model("Quiz", quizSchema);
export default Quiz;
