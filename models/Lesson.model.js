import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema(
  {
    module_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      required: true,
    },
    lesson_title: {
      type: String,
      required: true,
      trim: true,
    },
    lesson_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson_Type",
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    video_url: {
      type: String,
      default: "",
    },
    file_path: {
      type: String,
      default: "",
    },
    quiz_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      default: null,
    },
    live_session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Live_session",
      default: null,
    },
    lesson_duration: {
      type: Number,
      default: 0,
    },
    is_downloadable: {
      type: Boolean,
      // default: false,
    },
    is_preview: {
      type: Boolean,
      // default: false,
    },
    display_order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Lesson = mongoose.model("Lesson", lessonSchema);

export default Lesson;
