import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    course_title: {
      type: String,
      required: true,
      trim: true,
    },
    short_description: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      required: true,
    },
    language: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Language",
      required: true,
    },
    instructors: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    students: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
    },
    max_enrollment: {
      type: Number,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_archived: {
      type: Boolean,
      default: false,
    },

    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseLevel",
      required: true,
    },
    drip_content_enabled: {
      type: Boolean,
      default: false,
    },
    is_featured: {
      type: Boolean,
      default: false,
    },
    certificate_available: {
      type: Boolean,
      default: false,
    },
    start_date: {
      type: Date,
    },
    end_date: {
      type: Date,
    },
    image: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
courseSchema.index({ tenant: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ subcategory: 1 });
courseSchema.index({ language: 1 });
courseSchema.index({ level: 1 });

const Course = mongoose.model("Course", courseSchema);

export default Course;
