import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    subdomain: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Please enter a valid subdomain (only lowercase letters, numbers, and hyphens)",
      ],
    },
    is_active: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // This will add createdAt and updatedAt fields
  }
);

// Create and export the Tenant model
const Tenant = mongoose.model("Tenant", tenantSchema);

export default Tenant;
