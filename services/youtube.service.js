import { google } from "googleapis";
import fs from "fs";

const OAuth2 = google.auth.OAuth2;

// YouTube API Configuration (READ AT RUNTIME)
const getYouTubeConfig = () => {
  const {
    YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET,
    YOUTUBE_REDIRECT_URI,
    YOUTUBE_REFRESH_TOKEN,
  } = process.env;

  if (
    !YOUTUBE_CLIENT_ID ||
    !YOUTUBE_CLIENT_SECRET ||
    !YOUTUBE_REFRESH_TOKEN
  ) {
    throw new Error("YouTube API credentials missing in .env");
  }

  return {
    clientId: YOUTUBE_CLIENT_ID,
    clientSecret: YOUTUBE_CLIENT_SECRET,
    redirectUri:
      YOUTUBE_REDIRECT_URI ||
      "http://localhost:3000/api/youtube/callback",
    refreshToken: YOUTUBE_REFRESH_TOKEN,
  };
};

/**
 * Uploads a video file to YouTube
 */
export const uploadToYouTube = async (filePath, metadata = {}) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("Video file not found");
    }

    const {
      clientId,
      clientSecret,
      redirectUri,
      refreshToken,
    } = getYouTubeConfig();

    const oauth2Client = new OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    const response = await youtube.videos.insert({
      part: "snippet,status",
      requestBody: {
        snippet: {
          title: metadata.title || "Class Recording",
          description:
            metadata.description || "Uploaded from GoChess Platform",
          tags: metadata.tags || ["GoChess", "Education"],
          categoryId: "27", // Education
        },
        status: {
          privacyStatus:
            metadata.privacyStatus || "unlisted",
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    });

    return {
      success: true,
      videoId: response.data.id,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
    };
  } catch (error) {
    console.error(
      "YouTube Upload Error:",
      error.response?.data || error.message
    );
    throw error; // 🔥 THIS IS THE FIX
  }
};
