import mongoose from "mongoose";

const instructorPricingSchema = new mongoose.Schema(
  {
    instructor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Login",
      required: true,
    },
    price_per_hour: {
      type: Number,
      min: 0,
      default: 0,
    },
    payment_type: {
      type: String,
      enum: ["salary", "weekly", "daily", "hourly"],
      default: "salary",
    },
    payment_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    assigned_courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
  },
  {
    timestamps: true, // This will add createdAt and updatedAt fields
  }
);

// Create unique index for instructor_id (each instructor can have only one pricing record)
instructorPricingSchema.index({ instructor_id: 1 }, { unique: true });

// Create and export the InstructorPricing model
const InstructorPricing = mongoose.model("InstructorPricing", instructorPricingSchema);

export default InstructorPricing;
