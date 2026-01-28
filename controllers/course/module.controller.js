import Module from "../../models/Module.js";
import Lesson from "../../models/Lesson.model.js";

import Quiz from "../../models/QuizTable.js";
import Course from "../../models/Course.js";

export const addModuleToCourse = async (req, res) => {
  console.log("addModuleToCourse =================================");
  console.log(req.body, "req.body");
  try {
    const { course_id, module_title, module_description, display_order } =
      req.body;
    const module = await Module.create({
      course_id,
      module_title,
      module_description,
      display_order,
    });
    res.status(201).json({ success: true, data: module });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const addLessonToModule = async (req, res) => {
  try {
    const {
      module_id,
      lesson_title,
      lesson_Type_id,
      description,
      video_url,
      file_path,
      quiz_id,
      live_session_id,
      lesson_duration,
      is_downloadable,
      is_preview,
      display_order,
    } = req.body;
    const lesson = await Lesson.create({
      module_id,
      lesson_title,
      lesson_Type_id,
      description,
      video_url,
      file_path,
      quiz_id,
      live_session_id,
      lesson_duration,
      is_downloadable,
      is_preview,
      display_order,
    });
    res.status(201).json({ success: true, data: lesson });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const addQuizToLesson = async (req, res) => {
  try {
    const { lesson_id, title, description } = req.body;
    const quiz = await Quiz.create({
      lesson_id,
      title,
      description,
    });
    res.status(201).json({ success: true, data: quiz });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const assignInstructorsToCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { instructorIds } = req.body; // Array of user IDs
    const course = await Course.findByIdAndUpdate(
      courseId,
      { $addToSet: { instructors: { $each: instructorIds } } },
      { new: true }
    ).populate("instructors");
    res.status(200).json({ success: true, data: course });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// !=========================================== updated code ============================================
export const createModule = async (req, res) => {
  console.log("create module =================================");
  console.log(req.params, "req.params");
  try {
    const { module_title, module_description, display_order, is_locked } =
      req.body;
    console.log(req.body, "req.body");
    const { course_id } = req.params;
    // Validate required fields
    if (!module_title) {
      return res.status(400).json({
        success: false,
        message: "Course ID and Module Title are required",
      });
    }

    if (course_id) {
      // Validate that course exists
      const courseExists = await Course.findById(course_id);
      if (!courseExists) {
        return res.status(404).json({
          success: false,
          message: "Associated course not found",
        });
      }
    }

    // Check for duplicate module title within the same course
    const existingModule = await Module.findOne({
      module_title,
      course_id: { $in: [course_id] },
    });
    if (existingModule) {
      return res.status(409).json({
        success: false,
        message:
          "A module with this title already exists in the selected course",
      });
    }

    const module = new Module({
      module_title,
      module_description,
      display_order,
      is_locked,
    });
    if (course_id) {
      module.course_id.push(course_id);
    }
    await module.save();

    return res.status(201).json({
      success: true,
      message: "Module created successfully",
      data: module,
    });
  } catch (error) {
    console.error("Error in createModule:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred",
      error: error.message,
    });
  }
};

export const getModules = async (req, res) => {
  // get the modules with the display order
  try {
    console.log("getModules =================================");
    const modules = await Module.find()
      .populate({
        path: "course_id",
        model: "Course",
        select: "title description category subcategory level language",
      })
      .sort({ display_order: 1 }); // Optional: Sort by latest

    if (!modules || modules.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No modules found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Modules fetched successfully",
      data: modules,
    });
  } catch (error) {
    console.error("Error fetching modules:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve modules",
      error: error.message,
    });
  }
};

export const getModulesAssociatedWithTheCourse = async (req, res) => {
  try {
    const modules = await Module.find({ course_id: req.params.course_id });
    const lessons = await Lesson.find({
      module_id: { $in: modules.map((module) => module._id) },
    }).populate('lesson_type_id', 'lesson_type');
    
    const data = {
      modules,
      lessons,
    };
    res.status(200).json({ success: true, data: data });
  } catch (error) {
    console.error("Error fetching modules associated with the course:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const assignCourseToTheModules = async (req, res) => {
  try {
    const { course_id, module_id } = req.body;
    console.log(course_id, module_id, "course_id, module_id");

    // Use $addToSet to add course_id to the array without duplicates
    const module = await Module.findByIdAndUpdate(
      module_id,
      { $addToSet: { course_id: course_id } },
      { new: true }
    );

    if (!module) {
      return res.status(404).json({
        success: false,
        message: "Module not found",
      });
    }

    console.log(module, "module");
    res.status(200).json({ success: true, data: module });
  } catch (error) {
    console.error("Error assigning course to module:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCurrentCourseModules = async (req, res) => {
  try {
    const { id } = req.params;

    // Use $in operator to find modules where course_id array contains the specified course_id
    const modules = await Module.find({ course_id: { $in: [id] } }).sort({
      display_order: 1,
    }); // Sort by display order

    if (!modules || modules.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No modules found for this course",
      });
    }

    res.status(200).json({ success: true, data: modules });
  } catch (error) {
    console.error("Error fetching current course modules:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateDisplayOrder = async (req, res) => {
  console.log("updateDisplayOrder =================================");
  try {
    const { module_id } = req.params;
    const { display_order } = req.body;
    console.log(module_id, display_order, "module_id, display_order");
    const module = await Module.findByIdAndUpdate(module_id, { display_order });
    res.status(200).json({ success: true, data: module });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
