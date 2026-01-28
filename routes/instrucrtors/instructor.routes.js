import express from "express";
import {
  getAllInstructors,
  getCourseDetailsById,
  getInstructorStats,
  getStudentsByBatch,
} from "../../controllers/instructor/instructor.controller.js";
import { searchInstructor } from "../../controllers/instructor/instructor.controller.js";
import {
  getInstructorCourses,
  getInstructorAndDetailsById,
} from "../../controllers/instructor/course.controller.js";
import { assignCoursesToInstructor } from "../../controllers/course/course.controller.js";
import {
  getStudentsByTenant,
  createStudent,
} from "../../controllers/instructor/student.controller.js";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";

const router = express.Router();

router
  .route("/get_all")
  .get(authCheckMiddleware, authorizeRoles("tenant"), getAllInstructors);
router
  .route("/search/:searchValue")
  .get(authCheckMiddleware, authorizeRoles("tenant"), searchInstructor);
router.get(
  "/instructor-courses",
  authCheckMiddleware,
  authorizeRoles("tenant", "instructor"),
  getInstructorCourses
);
router.get(
  "/students",
  authCheckMiddleware,
  authorizeRoles("tenant", "instructor"),
  getStudentsByTenant
);
router.post(
  "/students",
  authCheckMiddleware,
  authorizeRoles("tenant", "instructor"),
  createStudent
);
router.get(
  "/get-instructor-by-id/:instructorId",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  getInstructorAndDetailsById
);
router.post(
  "/assign-courses/:instructorId",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  assignCoursesToInstructor
);

router.get(
  "/getcoursedatabyid/:id",
  authCheckMiddleware,
  authorizeRoles("tenant", "instructor"),
  getCourseDetailsById
);

router.get(
  "/stats",
  authCheckMiddleware,
  authorizeRoles("instructor"),
  getInstructorStats
);

router.get(
  "/get-students-by-batch",
  authCheckMiddleware,
  authorizeRoles("instructor"),
  getStudentsByBatch
);

export default router;
