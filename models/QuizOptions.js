import mongoose from "mongoose";

const quizOptionsSchema = new mongoose.Schema(
  {
    question_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuizQuestion",
      required: true,
    },
    option_text: {
      type: String,
      required: true,
      trim: true,
    },
    is_correct: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Create index for question_id for better query performance
quizOptionsSchema.index({ question_id: 1 });

const QuizOptions = mongoose.model("QuizOptions", quizOptionsSchema);

export default QuizOptions;
