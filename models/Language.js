import mongoose from "mongoose";

const LanguageSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Language = mongoose.model("Language", LanguageSchema);

export default Language;
