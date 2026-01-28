import mongoose from "mongoose";

const courseLevelSchema = new mongoose.Schema(
  {
    course_level: {
      type: String,
      required: true,
      enum: ["Beginner", "Intermediate", "Advanced"],
      trim: true,
    },  
  },
  {
    timestamps: true,
  }
);

const CourseLevel = mongoose.model("CourseLevel", courseLevelSchema);

export default CourseLevel;
