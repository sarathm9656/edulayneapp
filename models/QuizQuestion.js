import mongoose from "mongoose";

const quizQuestionSchema = new mongoose.Schema(
  {
    quiz_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    question_text: {
      type: String,
      required: true,
      trim: true,
    },
    question_type: {
      type: String,
      enum: ["mcq", "true_false", "fill_blank"],
      required: true,
    },
    score: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

const QuizQuestion = mongoose.model("QuizQuestion", quizQuestionSchema);

export default QuizQuestion;
