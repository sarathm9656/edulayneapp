import mongoose from "mongoose";
import { type } from "os";

const moduleSchema = new mongoose.Schema(
  {
    course_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },  
    module_title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    module_description: {
      type: String,
      default: "",
    },
    display_order: {
      type: Number,
      default: 0,
    },
    is_locked: {
      type: Boolean,
      default: false,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

moduleSchema.index({ course_id: 1, module_title: 1 }, { unique: true });

const Module = mongoose.model("Module", moduleSchema);

export default Module;
