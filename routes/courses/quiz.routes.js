// File: routes/course/quiz.routes.js

import express from "express";
import * as QuizController from "../../controllers/course/quiz.controller.js";

const router = express.Router();

/**
 * @route   POST /api/quiz
 * @desc    Create a new quiz
 * @access  Protected (Scoped by role/tenant middleware if applicable)
 *
 * @route   GET /api/quiz?course_id=&module_id=
 * @desc    Get quizzes by course/module
 */
router
  .route("/")
  .post(QuizController.createQuiz)
  .get(QuizController.getQuizzes);

/**
 * @route   POST /api/quiz/question
 * @desc    Add a new question to a quiz
 */
router.route("/question").post(QuizController.addQuizQuestion);

/**
 * @route   POST /api/quiz/options
 * @desc    Add options to a specific question
 */
router.route("/options").post(QuizController.addQuizOptions);

/**
 * @route   GET /api/quiz/:quiz_id
 * @desc    Get quiz details including questions and options
 */
router.route("/:quiz_id").get(QuizController.getQuizDetails);

/**
 * @route   POST /api/quiz/submit
 * @desc    Submit quiz answers for validation and grading
 */
router.route("/submit").post(QuizController.submitQuiz);

/**
 * @route   GET /api/quiz/results?student_id=&quiz_id=&course_id=
 * @desc    Get student quiz results
 */
router.route("/results").get(QuizController.getStudentQuizResults);

/**
 * @route   GET /api/quiz/result/:result_id
 * @desc    Get detailed quiz result with answers
 */
router.route("/result/:result_id").get(QuizController.getQuizResultDetails);

export default router;

