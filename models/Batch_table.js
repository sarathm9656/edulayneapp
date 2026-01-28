import mongoose from "mongoose";

const BatchSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    course_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    batch_name: {
      type: String,
      required: true,
      trim: true,
    },
    instructor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Login",
      required: false,
    },
    instructor_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Login",
    }],
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "completed"],
      default: "active",
    },
    // Subscription pricing for individual batch access
    subscription_price: {
      type: Number,
      default: 1000, // Default monthly subscription price in INR
      min: 0
    },
    currency: {
      type: String,
      default: "INR"
    },
    subscription_enabled: {
      type: Boolean,
      default: true // Enable/disable subscription for this batch
    },
    max_students: {
      type: Number,
      default: 0,
    },
    batch_time: {
      type: String,
    },
    is_strict_schedule: {
      type: Boolean,
      default: true,
    },
    recurring_days: {
      type: [String],
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    },
    meeting_link: {
      type: String,
    },
    meeting_platform: {
      type: String,
      enum: ["Dyte", "Google Meet", "Other"],
      default: "Dyte",
    },
    dyte_meeting_id: {
      type: String,
    },
    last_class_start_time: {
      type: Date,
    },
    manual_recordings: [
      {
        title: { type: String, required: true },
        file_path: { type: String, required: true },
        youtube_url: { type: String },
        status_note: { type: String },
        uploaded_at: { type: Date, default: Date.now },
      },
    ],
    // enrolled_students field removed - using separate BatchStudent model for enrollment tracking
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Batch = mongoose.model("Batch", BatchSchema);
export default Batch;
