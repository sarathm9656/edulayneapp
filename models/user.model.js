import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fname: {
      type: String,
      required: true,
      trim: true,
    },
    lname: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
    },

    dob: {
      type: Date,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    phone_number: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9]{10}$/, "Please enter a valid 10-digit phone number"],
    },
    gender: {
      type: String,
    enum: ["male", "female", "other", "prefer_not_to_say", ""],
    default: "prefer_not_to_say",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    profile_image: {
      type: String,
      default: "",
    },
    user_code: {
      type: String,
      unique: true,
      sparse: true, // Allows null/undefined values to exist without crashing on unique constraint
    },
  },
  {
    timestamps: true, // This will add createdAt and updatedAt fields
  }
);

// Create and export the User model
const User = mongoose.model("User", userSchema);

export default User;
