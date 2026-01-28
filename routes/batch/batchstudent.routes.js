import express from "express";
import * as BatchStudentController from "../../controllers/batch/batchstudent.controller.js";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";

const router = express.Router();

// Student batch routes
router.get(
  "/student/enrolled-batches",
  authCheckMiddleware,
  authorizeRoles("student"),
  BatchStudentController.getStudentEnrolledBatches
);

// Tenant batch student management routes
router.post(
  "/add-student",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  BatchStudentController.addStudentToBatch
);

router.get(
  "/:batch_id/students",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchStudentController.getBatchStudents
);

router.get(
  "/student/:student_id/batches",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchStudentController.getStudentBatches
);

router.put(
  "/:batch_id/student/:student_id/status",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  BatchStudentController.updateBatchStudentStatus
);

router.delete(
  "/:batch_id/student/:student_id",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  BatchStudentController.removeStudentFromBatch
);

router.get(
  "/:batch_id/students/status/:status",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchStudentController.getBatchStudentsByStatus
);

router.get(
  "/:batch_id/statistics",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchStudentController.getBatchStudentStatistics
);

router.post(
  "/bulk-add-students",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  BatchStudentController.bulkAddStudentsToBatch
);

router.get(
  "/:batch_id/search-students",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchStudentController.searchBatchStudents
);

router.get(
  "/:batch_id/student-count",
  authCheckMiddleware,
  authorizeRoles("tenant", "superadmin"),
  BatchStudentController.getBatchStudentCount
);

export default router;
