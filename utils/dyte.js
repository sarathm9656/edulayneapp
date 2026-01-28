import axios from "axios";

const dyteClient = axios.create({
  baseURL: "https://api.dyte.io/v2",
  auth: {
    username: process.env.DYTE_ORG_ID,
    password: process.env.DYTE_API_KEY
  }
});

export const createMeeting = async (title) => {
  const res = await dyteClient.post("/meetings", {
    title,
    preset_name: "group_call"
  });
  return res.data.data;
};

export const createParticipant = async (meetingId, name, role) => {
  // Map roles to Dyte presets
  // Admin/Instructor -> Host
  // Student -> Participant
  const preset = (role === "instructor" || role === "admin" || role === "superadmin")
    ? "group_call_host"
    : "group_call_participant";

  const res = await dyteClient.post(
    `/meetings/${meetingId}/participants`,
    {
      name,
      preset_name: preset,
      custom_participant_id: name // Optional: useful for tracking
    }
  );
  return res.data.data.token;
};

export const checkMeetingStatus = async (meetingId) => {
  try {
    const res = await dyteClient.get(`/meetings/${meetingId}`);
    return res.data.data.status; // 'ACTIVE', 'INACTIVE', 'USED'
  } catch (error) {
    console.error("Error checking Dyte meeting status:", error.response?.data || error.message);
    return null;
  }
};
