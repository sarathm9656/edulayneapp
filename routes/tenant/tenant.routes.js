import express from "express";
import {
  createTenant,
  getAllTenants,
  deleteTenant,
  getTenantById,
  updateTenant,
  updateStatus,
  getTenantList,
} from "../../controllers/super-admin/tenant.controller.js";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
import {
  getStudents,
  EnrollStudents,
  EnrollStudentsInCourse,
  getTenantStats,
  getLiveSessionsCount,
  getStudentById,
  updateStudentEnrollments,
  getDashboardAnalytics,
} from "../../controllers/tenant/tenant.controller.js";
import {
  getStudentsForBatch,
  enrollStudents,
} from "../../controllers/tenant/batch.controller.js";
const router = express.Router();

router
  .route("/")
  .get(authCheckMiddleware, authorizeRoles("superadmin", "tenant"), getAllTenants);

router
  .route("/list")
  .get(authCheckMiddleware, authorizeRoles("superadmin"), getTenantList);

router
  .route("/update/:id")
  .put(authCheckMiddleware, authorizeRoles("superadmin"), updateTenant);
router
  .route("/updatestatus/:id")
  .put(authCheckMiddleware, authorizeRoles("superadmin"), updateStatus);

router
  .route("/delete/:id")
  .delete(authCheckMiddleware, authorizeRoles("superadmin"), deleteTenant);

router
  .route("/students/get-students-by-company")
  .get(
    authCheckMiddleware,
    authorizeRoles("superadmin", "tenant"),
    getStudents
  );

// This section was causing a crash due to missing paths
// router
//   .delete(authCheckMiddleware, authorizeRoles("superadmin"), deleteTenant)
//   .get(authCheckMiddleware, authorizeRoles("superadmin"), getTenantById);

router
  .route("/students/:id")
  .get(authCheckMiddleware, authorizeRoles("tenant"), getStudentById)
  .put(authCheckMiddleware, authorizeRoles("tenant"), updateStudentEnrollments);
router
  .route("/tenant/getstudents/:course_id")
  .get(
    authCheckMiddleware,
    authorizeRoles("superadmin", "tenant"),
    getStudents
  );
// router
//   .route("/tenant/enrollstudents/:batch_id")
//   .post(
//     authCheckMiddleware,
//     authorizeRoles("superadmin", "tenant"),
//     EnrollStudents
//   );

router
  .route("/tenant/enrollstudents-course/:course_id")
  .post(
    authCheckMiddleware,
    authorizeRoles("superadmin", "tenant"),
    EnrollStudentsInCourse
  );

// New routes for batch enrollment
router
  .route("/tenant/getstudents-batch/:batch_id")
  .get(
    authCheckMiddleware,
    authorizeRoles("superadmin", "tenant"),
    getStudentsForBatch
  );

router
  .route("/tenant/enrollstudents-batch/:batch_id")
  .post(
    authCheckMiddleware,
    authorizeRoles("superadmin", "tenant"),
    enrollStudents
  );

// Get tenant statistics
router
  .route("/stats")
  .get(
    authCheckMiddleware,
    authorizeRoles("tenant"),
    getTenantStats
  );

// Get analytics data
router
  .route("/analytics")
  .get(
    authCheckMiddleware,
    authorizeRoles("tenant"),
    getDashboardAnalytics
  );

// Get live sessions count only
router
  .route("/live-sessions-count")
  .get(
    authCheckMiddleware,
    authorizeRoles("tenant"),
    getLiveSessionsCount
  );

export default router;
