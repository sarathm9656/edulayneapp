import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { uploadToYouTube } from "./services/youtube.service.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const {
  YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET,
  YOUTUBE_REDIRECT_URI,
  YOUTUBE_REFRESH_TOKEN,
} = process.env;

if (
  !YOUTUBE_CLIENT_ID ||
  !YOUTUBE_CLIENT_SECRET ||
  !YOUTUBE_REDIRECT_URI ||
  !YOUTUBE_REFRESH_TOKEN
) {
  throw new Error("YouTube API credentials missing in .env");
}


const testUpload = async () => {
  console.log("Testing YouTube Upload...");

  const testFilePath = path.join(__dirname, "test_video.mp4");

  if (!fs.existsSync(testFilePath)) {
    console.error("❌ test_video.mp4 not found");
    return;
  }

  try {
    const result = await uploadToYouTube(testFilePath, {
      title: "Test Upload",
      description: "Test video upload from Node.js",
      privacyStatus: "private",
    });

    console.log("✅ Upload Success:", result);
  } catch (error) {
    console.error("❌ Test Failed:", error.message || error);
  }
};

testUpload();
