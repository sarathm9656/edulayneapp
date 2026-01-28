import express from "express";
import * as LessonController from "../../controllers/course/lesson.controller.js"; // matches named exports
import { upload } from "../../config/multer/multer.config.js";

const router = express.Router();

router
  .route("/:module_id")
  .post(upload.single("file"), LessonController.createLesson);
router.route("/:module_id").get(LessonController.getLessons);
router
  .route("/get-lessons-name/:module_id")
  .get(LessonController.fetchLessonsNamesAssociatedWithModule);
router.route("/update-order").put(LessonController.updateLessonOrders);
router
  .route("/editlesson/:id")
  .put(upload.single("file"), LessonController.editLesson);

router
  .route("/:id")
  .delete(LessonController.deleteLesson);

router
  .route("/get-lesson-content/:lesson_id")
  .get(LessonController.getLessonContent);
export default router;
