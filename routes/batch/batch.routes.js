import express from "express";
import * as BatchController from "../../controllers/batch/batch.control.js";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";

const router = express.Router();

// Batch Routes
router
  .route("/")
  .post(
    authCheckMiddleware,
    authorizeRoles("tenant"),
    BatchController.createBatch
  )
  .get(
    authCheckMiddleware,
    authorizeRoles("tenant", "superadmin"),
    BatchController.getAllBatches
  );

router
  .route("/:batch_id")
  .put(
    authCheckMiddleware,
    authorizeRoles("tenant"),
    BatchController.updateBatch
  )
  .delete(
    authCheckMiddleware,
    authorizeRoles("tenant"),
    BatchController.deleteBatch
  )
  .get(
    authCheckMiddleware,
    authorizeRoles("tenant", "superadmin"),
    BatchController.getBatchById
  );

// Get batches by course
router.get(
  "/course/:course_id",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchController.getBatchesByCourse
);

// Get current instructor's batches (must come before /instructor/:instructor_id)
router.get(
  "/instructor/my-batches",
  authCheckMiddleware,
  authorizeRoles("instructor"),
  BatchController.getMyBatches
);

// Get batches by instructor
router.get(
  "/instructor/:instructor_id",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchController.getBatchesByInstructor
);

// Get active batches (current date is between start_date and end_date)
router.get(
  "/active/current",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchController.getActiveBatches
);

// Get upcoming batches (start_date is in the future)
router.get(
  "/upcoming",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchController.getUpcomingBatches
);

// Get completed batches (end_date is in the past)
router.get(
  "/completed",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchController.getCompletedBatches
);

// Search batches
router.get(
  "/search/:searchValue",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchController.searchBatches
);

// Get batch count
router.get(
  "/count/total",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchController.getBatchCount
);

// Get batches by status
router.get(
  "/status/:status",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchController.getBatchesByStatus
);

// Toggle batch status
router.patch(
  "/:batch_id/status",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  BatchController.toggleBatchStatus
);

// Get batch statistics
router.get(
  "/statistics/overview",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchController.getBatchStatistics
);

// Get students for a specific batch (for instructors)
router.get(
  "/:batch_id/students",
  authCheckMiddleware,
  authorizeRoles("instructor"),
  BatchController.getBatchStudentsForInstructor
);

export default router;
