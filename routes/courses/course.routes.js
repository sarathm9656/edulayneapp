import express from "express";
import * as CourseController from "../../controllers/course/course.controller.js";
import { uploadCourseImage } from "../../config/multer/multer.config.js";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";

const router = express.Router();

// Course Routes
router
  .route("/")
  .post(
    authCheckMiddleware,
    authorizeRoles("tenant"),
    uploadCourseImage.single("file"),
    CourseController.createCourse
  )
  .get(
    authCheckMiddleware,
    authorizeRoles("tenant"),
    CourseController.getAllCourses
  );

router
  .route("/count")
  .get(
    authCheckMiddleware,
    authorizeRoles("superadmin", "tenant"),
    CourseController.getCourseCount
  );
router
  .route("/:id")
  .put(
    authCheckMiddleware,
    authorizeRoles("tenant"),
    CourseController.updateCourse
  )
  .delete(
    authCheckMiddleware,
    authorizeRoles("tenant"),
    CourseController.deleteCourse
  )
  .get(
    authCheckMiddleware,
    authorizeRoles("tenant", "instructor", "superadmin", "student"),
    CourseController.getCourseById
  );

router.delete(
  "/:courseId/image",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  CourseController.deleteCourseImage
);

router.post(
  "/assign-instructors",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  CourseController.assignInstructors
);
router.post(
  "/toggle-active-status",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  CourseController.toggleCourseActiveStatus
);
router.post(
  "/set-course-dates",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  CourseController.setCourseDates
);
router.post(
  "/toggle-archive-status",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  CourseController.toggleArchiveStatus
);
router.get(
  "/get-course-names-with-id",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  CourseController.getCourseNamesWithId
);

router.get(
  "/category/:categoryId",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  CourseController.getCoursesByCategory
);

router.get(
  "/level/:levelId",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  CourseController.getCoursesByLevel
);

router.get(
  "/category/:categoryId/level/:levelId",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  CourseController.getCoursesByCategoryAndLevel
);

//   .route("/category")
//   .post(CategoryController.createCategory)
//   .get(CategoryController.getCategories);

// // Language Routes
// router
//   .route("/language")
//   .post(LanguageController.createLanguage)
//   .get(LanguageController.getLanguages);

// // Subcategory Routes
// router
//   .route("/subcategory")
//   .post(SubcategoryController.createSubcategory)
//   .get(SubcategoryController.getSubcategories);

// // Level Routes
// router
//   .route("/level")
//   .post(LevelController.createCourseLevel)
//   .get(LevelController.getCourseLevels);

// search courses
router.get(
  "/search/course/value/:searchValue",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  CourseController.searchCourses
);

export default router;
