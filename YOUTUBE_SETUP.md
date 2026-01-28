# YouTube API Integration for GoChess

This document explains how to set up the YouTube Data API v3 for automated video uploads.

## 1. Google Cloud Project Setup

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project named "GoChess".
3.  Go to **APIs & Services > Library**.
4.  Search for **YouTube Data API v3** and enable it.
5.  Go to **APIs & Services > OAuth consent screen**.
    -   Choose "External".
    -   Fill in the required App name, User support email, and Developer contact information.
    -   Add the scope: `.../auth/youtube.upload`.
    -   Add your email to "Test users" if your app is in "Testing" mode.
6.  Go to **APIs & Services > Credentials**.
    -   Click **Create Credentials > OAuth client ID**.
    -   Application type: "Web application".
    -   Name: "GoChess Server".
    -   Authorized redirect URIs: `https://developers.google.com/oauthplayground` (used for getting the refresh token).
    -   Note down your **Client ID** and **Client Secret**.

## 2. Generating the Refresh Token

Since the server needs to upload videos without manual login every time, we use a long-lived **Refresh Token**.

1.  Go to the [OAuth2 Playground](https://developers.google.com/oauthplayground/).
2.  Click the gear icon (top right) and check **"Use your own OAuth credentials"**.
3.  Enter your **Client ID** and **Client Secret**.
4.  In "Step 1: Select & authorize APIs", search for `https://www.googleapis.com/auth/youtube.upload` and click **Authorize APIs**.
5.  Sign in with your Google account and grant permissions (Ignore the "unverified app" warning if it appears).
6.  In "Step 2: Exchange authorization code for tokens", click **Exchange authorization code for tokens**.
7.  Note down the **Refresh Token**.

## 3. Environment Configuration (.env)

Add the following variables to your `server-side/.env` file:

```env
YOUTUBE_CLIENT_ID=your_client_id_here
YOUTUBE_CLIENT_SECRET=your_client_secret_here
YOUTUBE_REFRESH_TOKEN=your_refresh_token_here
YOUTUBE_REDIRECT_URI=https://developers.google.com/oauthplayground
```

## 4. Usage in Code

To upload a video to YouTube from the server:

```javascript
import { uploadToYouTube } from './services/youtube.service.js';

const result = await uploadToYouTube('path/to/video.mp4', {
  title: 'My Course Title',
  description: 'This is a description',
  privacyStatus: 'unlisted'
});

if (result.success) {
  console.log('YouTube URL:', result.url);
}
```
