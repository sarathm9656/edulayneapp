import { tenantMiddleware } from "../../middleware/tenant.middleware.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { instructorMiddleware } from "../../middleware/instructor.middleware.js";
import {
  createMeeting,
  getMeetings,
  updateMeeting,
  cancelMeeting,
  deleteMeeting,
  assignBatchToLiveSession,
  getLiveSessionsByBatch,
  getMeetingsWithBatches,
  getInstructorPayments,
  updatePaymentStatus,
  getStudentLiveSessions,
  getInstructorLiveSessions,
  updateMeetingStatus,
  updateAllMeetingStatuses,
} from "../../controllers/meetings/meeting.controller.js";
import express from "express";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
const router = express.Router();

router
  .route("/meetings")
  .get(
    authCheckMiddleware,
    authorizeRoles("instructor", "tenant"),
    getMeetings
  );
router
  .route("/meetings-with-batches")
  .get(
    authCheckMiddleware,
    authorizeRoles("instructor", "tenant"),
    getMeetingsWithBatches
  );
router
  .route("/create_meetings")
  .post(
    authCheckMiddleware,
    authorizeRoles("instructor", "tenant"),
    createMeeting
  );
router
  .route("/edit_meetings/:meetingId")
  .put(
    authCheckMiddleware,
    authorizeRoles("instructor", "tenant"),
    updateMeeting
  );
router
  .route("/cancel_meetings/:meetingId")
  .put(
    authCheckMiddleware,
    authorizeRoles("instructor", "tenant"),
    cancelMeeting
  );
router
  .route("/delete_meetings/:meetingId")
  .delete(
    authCheckMiddleware,
    authorizeRoles("instructor", "tenant"),
    deleteMeeting
  );
router
  .route("/assign-batch/:meetingId")
  .put(
    authCheckMiddleware,
    authorizeRoles("instructor", "tenant"),
    assignBatchToLiveSession
  );
router
  .route("/batch/:batchId/live-sessions")
  .get(
    authCheckMiddleware,
    authorizeRoles("instructor", "tenant"),
    getLiveSessionsByBatch
  );

// Student live sessions route
router
  .route("/student/live-sessions")
  .get(authCheckMiddleware, authorizeRoles("student"), getStudentLiveSessions);

// Instructor live sessions route - filtered by instructor's batches
router
  .route("/instructor/live-sessions")
  .get(
    authCheckMiddleware,
    authorizeRoles("instructor"),
    getInstructorLiveSessions
  );

// Instructor payment routes
router
  .route("/instructor-payments")
  .get(authCheckMiddleware, authorizeRoles("tenant", "instructor"), getInstructorPayments);
router
  .route("/instructor-payments/:paymentId/status")
  .put(authCheckMiddleware, authorizeRoles("tenant"), updatePaymentStatus);

// Meeting status update routes
router
  .route("/update-status/:meetingId")
  .put(
    authCheckMiddleware,
    authorizeRoles("instructor", "tenant"),
    updateMeetingStatus
  );
router
  .route("/update-all-statuses")
  .put(
    authCheckMiddleware,
    authorizeRoles("instructor", "tenant"),
    updateAllMeetingStatuses
  );

export default router;
