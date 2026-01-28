import mongoose from "mongoose";

const quizResultSchema = new mongoose.Schema(
    {
        quiz_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Quiz",
            required: true,
        },
        student_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
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
        answers: [
            {
                question_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "QuizQuestion",
                    required: true,
                },
                selected_option_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "QuizOptions",
                },
                text_answer: {
                    type: String,
                },
                is_correct: {
                    type: Boolean,
                    required: true,
                },
                points_earned: {
                    type: Number,
                    default: 0,
                },
            },
        ],
        total_score: {
            type: Number,
            required: true,
            default: 0,
        },
        max_score: {
            type: Number,
            required: true,
        },
        percentage: {
            type: Number,
            required: true,
            default: 0,
        },
        passed: {
            type: Boolean,
            required: true,
            default: false,
        },
        attempt_number: {
            type: Number,
            required: true,
            default: 1,
        },
        time_taken_minutes: {
            type: Number,
            required: true,
        },
        started_at: {
            type: Date,
            required: true,
        },
        completed_at: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    }
);

// Create indexes for better query performance
quizResultSchema.index({ quiz_id: 1, student_id: 1 });
quizResultSchema.index({ student_id: 1, course_id: 1 });

const QuizResult = mongoose.model("QuizResult", quizResultSchema);

export default QuizResult;
