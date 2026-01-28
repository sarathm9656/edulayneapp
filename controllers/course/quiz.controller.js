import QuizOptions from "../../models/QuizOptions.js";
import QuizQuestion from "../../models/QuizQuestion.js";
import Quiz from "../../models/QuizTable.js";
import QuizResult from "../../models/QuizResult.js";

export const createQuiz = async (req, res) => {
  try {
    const {
      course_id,
      module_id,
      title,
      description,
      pass_percentage,
      time_limit_minutes,
      attempts_allowed,
    } = req.body;

    if (
      !course_id ||
      !module_id ||
      !title ||
      !description ||
      !pass_percentage ||
      !time_limit_minutes ||
      !attempts_allowed
    ) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const existingQuiz = await Quiz.findOne({
      course_id,
      module_id,
      title,
    });

    if (existingQuiz) {
      return res
        .status(400)
        .json({ success: false, message: "Quiz already exists" });
    }

    const quiz = new Quiz({
      course_id,
      module_id,
      title,
      description,
      pass_percentage,
      time_limit_minutes,
      attempts_allowed,
    });

    await quiz.save();
    return res.status(201).json({ success: true, data: quiz });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getQuizzes = async (req, res) => {
  try {
    const { course_id, module_id } = req.query;

    const quizzes = await Quiz.find({ course_id, module_id }).populate(
      "course_id module_id"
    );
    if (!quizzes || quizzes.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    // console.log(quizzes);
    return res.status(200).json({ success: true, data: quizzes });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addQuizQuestion = async (req, res) => {
  try {
    const { quiz_id, question_text, question_type, score } = req.body;

    if (!quiz_id || !question_text || !question_type || !score) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const existingQuestion = await QuizQuestion.findOne({
      quiz_id,
      question_text,
    });

    if (existingQuestion) {
      return res
        .status(400)
        .json({ success: false, message: "Question already exists" });
    }

    const question = new QuizQuestion({
      quiz_id,
      question_text,
      question_type,
      score,
    });

    await question.save();
    return res.status(201).json({ success: true, data: question });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addQuizOptions = async (req, res) => {
  try {
    const { question_id, options } = req.body; // options: [{ option_text, is_correct }, ...]

    if (!question_id || !Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({
        success: false,
        message: "question_id and 4 options are required",
      });
    }

    const existingOptions = await QuizOptions.find({ question_id });
    if (existingOptions.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Options already exist for this question",
      });
    }

    const correctCount = options.filter((opt) => opt.is_correct).length;
    if (correctCount !== 1) {
      return res.status(400).json({
        success: false,
        message: "Exactly one correct option must be provided",
      });
    }

    const formattedOptions = options.map((opt) => ({
      question_id,
      option_text: opt.option_text,
      is_correct: opt.is_correct,
    }));

    const createdOptions = await QuizOptions.insertMany(formattedOptions);

    return res.status(201).json({ success: true, data: createdOptions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getQuizDetails = async (req, res) => {
  try {
    const { quiz_id } = req.params;
    console.log(quiz_id);

    const questions = await QuizQuestion.find({ quiz_id });

    if (!questions) {
      return res
        .status(404)
        .json({ success: false, message: "No questions found" });
    }

    const questionsWithOptions = await Promise.all(
      questions.map(async (q) => {
        const options = await QuizOptions.find({ question_id: q._id });
        return { ...q.toObject(), options };
      })
    );

    if (!questionsWithOptions) {
      return res
        .status(404)
        .json({ success: false, message: "No questions found" });
    }

    return res.status(200).json({ success: true, data: questionsWithOptions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const submitQuiz = async (req, res) => {
  try {
    const { quiz_id, student_id, course_id, module_id, answers, time_taken_minutes, started_at } = req.body;

    if (!quiz_id || !student_id || !course_id || !module_id || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // Get quiz details
    const quiz = await Quiz.findById(quiz_id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    // Check attempt limit
    const previousAttempts = await QuizResult.find({ quiz_id, student_id }).sort({ attempt_number: -1 });
    const attemptNumber = previousAttempts.length + 1;

    if (attemptNumber > quiz.attempts_allowed) {
      return res.status(400).json({
        success: false,
        message: `Maximum attempts (${quiz.attempts_allowed}) exceeded`
      });
    }

    // Get all questions for this quiz
    const questions = await QuizQuestion.find({ quiz_id });

    let totalScore = 0;
    let maxScore = 0;
    const validatedAnswers = [];

    // Validate each answer
    for (const question of questions) {
      maxScore += question.score;

      const studentAnswer = answers.find(a => a.question_id === question._id.toString());

      if (!studentAnswer) {
        validatedAnswers.push({
          question_id: question._id,
          is_correct: false,
          points_earned: 0,
        });
        continue;
      }

      let isCorrect = false;
      let pointsEarned = 0;

      if (question.question_type === "mcq") {
        const correctOption = await QuizOptions.findOne({
          question_id: question._id,
          is_correct: true
        });

        if (correctOption && studentAnswer.selected_option_id === correctOption._id.toString()) {
          isCorrect = true;
          pointsEarned = question.score;
          totalScore += question.score;
        }

        validatedAnswers.push({
          question_id: question._id,
          selected_option_id: studentAnswer.selected_option_id,
          is_correct: isCorrect,
          points_earned: pointsEarned,
        });
      } else if (question.question_type === "true_false") {
        const correctOption = await QuizOptions.findOne({
          question_id: question._id,
          is_correct: true
        });

        if (correctOption && studentAnswer.selected_option_id === correctOption._id.toString()) {
          isCorrect = true;
          pointsEarned = question.score;
          totalScore += question.score;
        }

        validatedAnswers.push({
          question_id: question._id,
          selected_option_id: studentAnswer.selected_option_id,
          is_correct: isCorrect,
          points_earned: pointsEarned,
        });
      } else if (question.question_type === "fill_blank") {
        const correctOption = await QuizOptions.findOne({
          question_id: question._id,
          is_correct: true
        });

        if (correctOption && studentAnswer.text_answer?.trim().toLowerCase() === correctOption.option_text.trim().toLowerCase()) {
          isCorrect = true;
          pointsEarned = question.score;
          totalScore += question.score;
        }

        validatedAnswers.push({
          question_id: question._id,
          text_answer: studentAnswer.text_answer,
          is_correct: isCorrect,
          points_earned: pointsEarned,
        });
      }
    }

    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const passed = percentage >= quiz.pass_percentage;

    const quizResult = new QuizResult({
      quiz_id,
      student_id,
      course_id,
      module_id,
      answers: validatedAnswers,
      total_score: totalScore,
      max_score: maxScore,
      percentage: Math.round(percentage * 100) / 100,
      passed,
      attempt_number: attemptNumber,
      time_taken_minutes: time_taken_minutes || 0,
      started_at: started_at || new Date(),
      completed_at: new Date(),
    });

    await quizResult.save();

    return res.status(201).json({
      success: true,
      data: quizResult,
      message: passed ? "Congratulations! You passed the quiz!" : "You did not pass. Please try again."
    });
  } catch (error) {
    console.error("Error submitting quiz:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStudentQuizResults = async (req, res) => {
  try {
    const { student_id, quiz_id, course_id } = req.query;

    const filter = {};
    if (student_id) filter.student_id = student_id;
    if (quiz_id) filter.quiz_id = quiz_id;
    if (course_id) filter.course_id = course_id;

    const results = await QuizResult.find(filter)
      .populate("quiz_id", "title description pass_percentage")
      .populate("course_id", "course_title")
      .populate("module_id", "module_title")
      .sort({ created_at: -1 });

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getQuizResultDetails = async (req, res) => {
  try {
    const { result_id } = req.params;

    const result = await QuizResult.findById(result_id)
      .populate("quiz_id")
      .populate("student_id", "name email")
      .populate("course_id", "course_title")
      .populate("module_id", "module_title");

    if (!result) {
      return res.status(404).json({ success: false, message: "Result not found" });
    }

    // Get questions with options for detailed view
    const questionsWithDetails = await Promise.all(
      result.answers.map(async (answer) => {
        const question = await QuizQuestion.findById(answer.question_id);
        const options = await QuizOptions.find({ question_id: answer.question_id });
        return {
          ...answer.toObject(),
          question,
          options,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        ...result.toObject(),
        detailed_answers: questionsWithDetails,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
