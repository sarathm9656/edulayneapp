import express from "express";
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUsersByTenant,
  getUsersByRole,
  searchUsers,
  toggleUserStatus,
  requestPasswordReset,
  getUsersCount,
} from "../../controllers/user/user.controller.js";
import { tenantMiddleware } from "../../middleware/tenant.middleware.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import {
  loginUser,
  getCurrentUser,
  debugInstructorPricing,
} from "../../controllers/auth/userAuth.controlller.js";
import { userMiddleware } from "../../middleware/user.middleware.js";
import { isSuperAdmin } from "../../middleware/isSuperAdmin.js";
const router = express.Router();
import {
  getCourses,
  getStudentCourse,
  getStudentStats,
} from "../../controllers/user/student.controller.js";
import { getStudentEnrolledBatches } from "../../controllers/batch/batchstudent.controller.js";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";
router
  .route("/")
  .get(authCheckMiddleware, authorizeRoles("tenant", "superadmin", "instructor"), getAllUsers)
  .post(authCheckMiddleware, authorizeRoles("tenant", "superadmin", "instructor"), createUser);
// router.route('/update-instructor').put(authMiddleware);
router.route("/count").get(authMiddleware, isSuperAdmin, getUsersCount);
router
  .route("/:id")
  .get(authCheckMiddleware, authorizeRoles("tenant", "superadmin", "instructor"), getUserById)
  .put(authCheckMiddleware, authorizeRoles("tenant", "superadmin", "instructor"), updateUser)
  .delete(authCheckMiddleware, authorizeRoles("tenant", "superadmin"), deleteUser);
router.route("/tenant/:tenant_id").get(getUsersByTenant);
router.route("/role/:role_id").get(getUsersByRole);
router.route("/login").post(loginUser);
router.route("/getcurrentuser/me").get(authCheckMiddleware, authorizeRoles("tenant", "student", "instructor"), getCurrentUser);
router.route("/debug-pricing").get(authCheckMiddleware, authorizeRoles("instructor"), debugInstructorPricing);
router.route("/search/:searchValue").get(tenantMiddleware, searchUsers);
router.route("/toggle-status/:id").put(toggleUserStatus);
router.route("/requestpasswordreset").post(requestPasswordReset);

router.route("/getcourses/tenent").get(authCheckMiddleware, authorizeRoles("tenant", "student"), getCourses);
router
  .route("/student/getstudentcourse/:course_id")
  .get(authCheckMiddleware, authorizeRoles("tenant", "student"), getStudentCourse);

// Student batch routes
router
  .route("/student/enrolled-batches")
  .get(authCheckMiddleware, authorizeRoles("student"), getStudentEnrolledBatches);

// Student statistics route
router
  .route("/student/stats")
  .get(authCheckMiddleware, authorizeRoles("student"), getStudentStats);

export default router;
