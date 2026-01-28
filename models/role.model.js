import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
        default: [],
      },
    ],
  },
  {
    timestamps: true, // This will add createdAt and updatedAt fields
  }
);

// Create and export the Role model
const Role = mongoose.model("Role", roleSchema);

export default Role;
