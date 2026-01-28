import mongoose from "mongoose";

const BatchStudentSchema = new mongoose.Schema({
  batch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: true,
  },
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Login",
    required: true,
  },
  joined_at: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["active", "dropped", "completed", "suspended"],
    default: "active",
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
});

// Add compound unique index to prevent duplicate enrollments
BatchStudentSchema.index({ batch_id: 1, student_id: 1 }, { unique: true });

const BatchStudent = mongoose.model("BatchStudent", BatchStudentSchema);
export default BatchStudent;
