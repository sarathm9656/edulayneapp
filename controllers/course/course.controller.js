import mongoose, { Mongoose } from "mongoose";
import Course from "../../models/Course.js";
import Category from "../../models/Category.js";
import Subcategory from "../../models/Subcategory.js";
import Language from "../../models/Language.js";
import Level from "../../models/CourseLevel.js";
import User from "../../models/user.model.js";
import Role from "../../models/role.model.js";
import Login from "../../models/login.model.js";
import path from "path";
import fs from "fs";
import Module from "../../models/Module.js";
import Lesson from "../../models/Lesson.model.js";

// Create a new course
export const createCourse = async (req, res) => {
  try {
    const {
      course_title,
      short_description,
      description,
      category,
      subcategory,
      language,
      level,
      max_enrollment,
      start_date,
      end_date,
      instructors,
      drip_content_enabled,
      is_featured,
      certificate_available,
    } = req.body;
    const { tenant_id } = req.user;

    // Basic validation for mandatory fields
    if (
      !course_title ||
      !short_description ||
      !description ||
      !category ||
      !subcategory ||
      !language ||
      !level ||
      !max_enrollment ||
      !tenant_id
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided.",
        missingFields: {
          course_title: !course_title,
          short_description: !short_description,
          description: !description,
          category: !category,
          subcategory: !subcategory,
          language: !language,
          level: !level,
          max_enrollment: !max_enrollment,
          tenant_id: !tenant_id,
        },
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Course image is required.",
      });
    }

    // Check if course title is unique
    const existingCourse = await Course.findOne({
      course_title,
      tenant_id,
    });
    if (existingCourse) {
      return res.status(409).json({
        success: false,
        message:
          "Course title already exists. Please use a different title for this tenant.",
      });
    }
    // Create and save the new course
    const course = new Course({
      course_title,
      short_description,
      description,
      category,
      subcategory,
      language,
      level,
      tenant_id,
      max_enrollment,
      instructors: instructors || [],
      start_date,
      end_date,
      drip_content_enabled: drip_content_enabled || false,
      is_featured: is_featured || false,
      certificate_available: certificate_available || false,
      image: req.file.filename || null,
    });

    await course.save();

    return res.status(201).json({
      success: true,
      message: "Course created successfully.",
      data: course,
    });
  } catch (error) {
    console.error("Course creation failed:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while creating the course.",
      error: error.message,
    });
  }
};

// Get single course by ID
export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("instructors", "fname lname email _id")
      .populate("category", "category")
      .populate("subcategory", "subcategory_name")
      .populate("language", "language")
      .populate("level", "course_level");

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Auto-inactivate if expired
    if (course.is_active && course.end_date && new Date(course.end_date) < new Date()) {
      course.is_active = false;
      await course.save();
    }

    return res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching the course",
      error: error.message,
    });
  }
};

// Update course
export const updateCourse = async (req, res) => {
  try {
    // Find and update course
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    // Prepare update data
    const updateData = {
      ...req.body,
      updatedBy: req.user._id,
      updatedAt: Date.now(),
    };

    // Auto-reactivate if end_date is updated to a future date
    if (updateData.end_date && new Date(updateData.end_date) > new Date()) {
      updateData.is_active = true;
    }

    // Update course
    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate("instructors", "fname lname email");

    res.status(200).json({
      success: true,
      data: updatedCourse,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating the course",
      error: error.message,
    });
  }
};

// Delete course
export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Check if course has enrolled students
    if (
      Array.isArray(course.enrolledStudents) &&
      course.enrolledStudents.length > 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete course with enrolled students",
      });
    }

    await Course.deleteOne({ _id: course._id });

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting the course",
      error: error.message,
    });
  }
};

// Get course statistics
export const getCourseStats = async (req, res) => {
  try {
    const stats = await Course.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalEnrollments: { $sum: { $size: "$enrolledStudents" } },
        },
      },
    ]);

    const categoryStats = await Course.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusStats: stats,
        categoryStats,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching course statistics",
      error: error.message,
    });
  }
};

// ! assign courses to instructor

export const assignCoursesToInstructor = async (req, res) => {
  const { instructorId } = req.params;
  const { courseIds } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(instructorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid instructorId",
      });
    }

    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No course IDs provided",
      });
    }

    // Find the instructor to get the User document ID
    const instructor = await Login.findById(instructorId).populate("user_id");
    if (!instructor || !instructor.user_id) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    const userDocumentId = instructor.user_id._id;

    const results = [];
    for (const item of courseIds) {
      const { courseid, status } = item;
      if (!mongoose.Types.ObjectId.isValid(courseid)) {
        results.push({
          courseid,
          status,
          success: false,
          message: "Invalid courseid",
        });
        continue;
      }
      if (status === true) {
        // Add User document ID to course's instructors array
        await Course.updateOne(
          { _id: courseid },
          { $addToSet: { instructors: userDocumentId } }
        );
        results.push({ courseid, status, action: "added", success: true });
      } else if (status === false) {
        // Remove User document ID from course's instructors array
        await Course.updateOne(
          { _id: courseid },
          { $pull: { instructors: userDocumentId } }
        );
        results.push({ courseid, status, action: "removed", success: true });
      } else {
        results.push({
          courseid,
          status,
          success: false,
          message: "Invalid status value",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Instructor assignment processed.",
      results,
    });
  } catch (error) {
    console.error("assignCoursesToInstructor error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while assigning courses to instructor",
      error: error.message,
    });
  }
};

export const assignInstructors = async (req, res) => {
  const { courseId, instructorIds } = req.body;

  // Input validation
  if (
    !courseId ||
    !Array.isArray(instructorIds) ||
    instructorIds.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Both courseId and a non-empty instructorIds array are required.",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid courseId format.",
    });
  }

  const invalidInstructorIds = instructorIds.filter(
    (id) => !mongoose.Types.ObjectId.isValid(id)
  );

  if (invalidInstructorIds.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Invalid instructorIds: ${invalidInstructorIds.join(", ")}`,
    });
  }

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found.",
      });
    }

    // Filter out already assigned instructors
    const alreadyAssigned = instructorIds.filter((id) =>
      course.instructors
        .map((instructorId) => instructorId.toString())
        .includes(id)
    );

    const newInstructors = instructorIds.filter(
      (id) => !alreadyAssigned.includes(id)
    );

    if (newInstructors.length === 0) {
      return res.status(200).json({
        success: false,
        message:
          "All provided instructors are already assigned to this course.",
        alreadyAssigned,
      });
    }

    // Assign only new instructors
    course.instructors.push(...newInstructors);
    await course.save();
    // console.log(
    //   "============================================ not going to this"
    // );
    return res.status(200).json({
      success: true,
      message: "Instructors assigned successfully.",
      data: course,
    });
  } catch (error) {
    // console.log("================================================");
    console.log(error);
    // console.log("================================================");
    return res.status(500).json({
      success: false,
      message: "An error occurred while assigning instructors.",
      error: error.message,
    });
  }
};

export const toggleCourseActiveStatus = async (req, res) => {
  const { courseId, isActive } = req.body;

  // Validate courseId
  if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid or missing courseId.",
    });
  }

  // Validate isActive
  if (typeof isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "The 'isActive' field must be a boolean value.",
    });
  }

  try {
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found.",
      });
    }

    // Check if the status is already the same
    if (course.is_active === isActive) {
      return res.status(200).json({
        success: false,
        message: `Course is already ${isActive ? "active" : "inactive"}.`,
      });
    }

    course.is_active = isActive;
    await course.save();

    return res.status(200).json({
      success: true,
      message: `Course has been successfully ${isActive ? "activated" : "deactivated"
        }.`,
      data: course,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred.",
      error: error.message,
    });
  }
};

export const setCourseDates = async (req, res) => {
  const { courseId, start_date, end_date } = req.body;

  // Validate courseId
  if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid or missing courseId.",
    });
  }

  // Validate date formats
  if (!start_date || !end_date) {
    return res.status(400).json({
      success: false,
      message: "Both start_date and end_date are required.",
    });
  }

  const start = new Date(start_date);
  const end = new Date(end_date);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format. Use ISO format: YYYY-MM-DD.",
    });
  }

  if (start >= end) {
    return res.status(400).json({
      success: false,
      message: "Start date must be earlier than end date.",
    });
  }

  try {
    const course = await Course.findByIdAndUpdate(
      courseId,
      { start_date: start, end_date: end },
      { new: true }
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Course dates updated successfully.",
      data: course,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating course dates.",
      error: error.message,
    });
  }
};

export const toggleArchiveStatus = async (req, res) => {
  const { courseId, archive } = req.body;

  // Validate courseId
  if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid or missing courseId.",
    });
  }

  // Validate archive boolean
  if (typeof archive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "'archive' field must be a boolean value (true or false).",
    });
  }

  try {
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found.",
      });
    }

    if (course.is_archived === archive) {
      return res.status(200).json({
        success: false,
        message: `Course is already ${archive ? "archived" : "unarchived"}.`,
      });
    }

    course.is_archived = archive;
    await course.save();

    return res.status(200).json({
      success: true,
      message: `Course has been successfully ${archive ? "archived" : "unarchived"
        }.`,
      data: course,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating course archive status.",
      error: error.message,
    });
  }
};

// Get all courses
export const getAllCourses = async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { limit = 10, page = 1 } = req.query;

    // Validate pagination parameters
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be a number between 1 and 100",
      });
    }

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be a positive number",
      });
    }

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

    // Calculate skip value
    const skip = (pageNum - 1) * limitNum;

    // Auto-inactivate expired courses for this tenant before fetching
    await Course.updateMany(
      {
        tenant_id,
        is_active: true,
        end_date: { $lt: new Date() }
      },
      { $set: { is_active: false } }
    );

    // Get total count for pagination
    const totalCourses = await Course.countDocuments({ tenant_id });
    const totalPages = Math.ceil(totalCourses / limitNum);

    const courses = await Course.find({ tenant_id })
      .limit(limitNum)
      .skip(skip)
      .populate("category")
      .populate("subcategory", "subcategory_name")
      .populate("language")
      .populate("level")
      .populate("instructors")
      .sort({ createdAt: -1 });

    // Add studentCount from CoursePurchase model
    const CoursePurchase = (await import("../../models/Course_Purchase.js"))
      .default;
    const coursesWithStudentCount = await Promise.all(
      courses.map(async (course) => {
        const studentCount = await CoursePurchase.countDocuments({
          course_id: course._id,
        });
        return {
          ...course.toObject(),
          studentCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: coursesWithStudentCount,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCourses,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching courses",
      error: error.message,
    });
  }
};

// !search courses
export const searchCourses = async (req, res) => {
  try {
    const { searchValue } = req.params;
    // console.log(searchValue, "searchValue========================");
    const { tenant_id } = req.user;
    let courses = [];
    if (searchValue === "") {
      courses = await Course.find({ tenant_id })
        .populate("category", "category")
        .populate("subcategory", "subcategory_name")
        .populate("language", "language")
        .populate("level", "course_level");

      return res.status(200).json({
        success: true,
        message: "Courses retrieved successfully",
        data: courses,
      });
    }
    if (searchValue) {
      courses = await Course.find({
        tenant_id,
        $or: [
          { course_title: { $regex: searchValue, $options: "i" } },
          { description: { $regex: searchValue, $options: "i" } },
        ],
      })
        .populate("category", "category")
        .populate("subcategory", "subcategory_name")
        .populate("language", "language")
        .populate("level", "course_level");
    }
    const filteredCourses = courses.filter((course) => {
      return (
        course.category?.name
          ?.toLowerCase()
          .includes(searchValue.toLowerCase()) ||
        course.subcategory?.name
          ?.toLowerCase()
          .includes(searchValue.toLowerCase()) ||
        course.language?.name
          ?.toLowerCase()
          .includes(searchValue.toLowerCase()) ||
        course.level?.name?.toLowerCase().includes(searchValue.toLowerCase())
      );
    });

    const finalResults = [...courses, ...filteredCourses].filter(
      (value, index, self) =>
        index ===
        self.findIndex((v) => v._id.toString() === value._id.toString())
    );

    return res.status(200).json({
      success: true,
      message: "Courses retrieved based on search",
      data: finalResults,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while searching for courses.",
      error: error.message,
    });
  }
};

export const getCourseNamesWithId = async (req, res) => {
  const { tenant_id } = req.user;
  try {
    const courses = await Course.find({ tenant_id });
    const courseNames = courses.map((course) => ({
      id: course._id,
      course_title: course.course_title,
    }));
    return res.status(200).json({
      success: true,
      data: courseNames,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching course names",
      error: error.message,
    });
  }
};

export const getCourseCount = async (req, res) => {
  try {
    const courses = await Course.find({});
    return res.status(200).json({
      success: true,
      data: courses.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching course count",
      error: error.message,
    });
  }
};

export const getCoursesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { tenant_id } = req.user;
    const courses = await Course.find({ category: categoryId, tenant_id })
      .populate("category")
      .populate("subcategory", "subcategory_name")
      .populate("language")
      .populate("level");

    return res.status(200).json({
      success: true,
      data: courses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching courses by category",
      error: error.message,
    });
  }
};

export const getCoursesByLevel = async (req, res) => {
  try {
    const { levelId } = req.params;
    const { tenant_id } = req.user;

    console.log("getCoursesByLevel called with levelId:", levelId);
    console.log("tenant_id:", tenant_id);

    const courses = await Course.find({ level: levelId, tenant_id })
      .populate("category")
      .populate("subcategory", "subcategory_name")
      .populate("language")
      .populate("level");

    console.log("Found courses:", courses.length);
    console.log("Courses:", courses);

    return res.status(200).json({
      success: true,
      data: courses,
    });
  } catch (error) {
    console.error("Error in getCoursesByLevel:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching courses by level",
      error: error.message,
    });
  }
};

export const getCoursesByCategoryAndLevel = async (req, res) => {
  try {
    const { categoryId, levelId } = req.params;
    const { tenant_id } = req.user;

    console.log(
      "getCoursesByCategoryAndLevel called with categoryId:",
      categoryId,
      "levelId:",
      levelId
    );
    console.log("tenant_id:", tenant_id);

    const courses = await Course.find({
      category: categoryId,
      level: levelId,
      tenant_id,
    })
      .populate("category")
      .populate("subcategory", "subcategory_name")
      .populate("language")
      .populate("level");

    console.log("Found courses with category and level:", courses.length);
    console.log("Courses:", courses);

    return res.status(200).json({
      success: true,
      data: courses,
    });
  } catch (error) {
    console.error("Error in getCoursesByCategoryAndLevel:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching courses by category and level",
      error: error.message,
    });
  }
};

export const deleteCourseImage = async (req, res) => {
  const { courseId } = req.params;
  const { tenant_id } = req.user;
  const course = await Course.findById(courseId);
  if (!course) {
    return res.status(404).json({
      success: false,
      message: "Course not found",
    });
  }
  if (course.tenant_id !== tenant_id) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to delete this course",
    });
  }
  // find and delete the modules having the course id inside it
  const modules = await Module.find({ course_id: courseId });
  if (modules.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Cannot delete course with modules",
    });
  }

  const image = course.image;
  if (!image) {
    return res.status(400).json({
      success: false,
      message: "Course image not found",
    });
  }
  const imagePath = path.join(
    __dirname,
    "..",
    "..",
    "uploads",
    "courses",
    image
  );
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
  course.image = null;
  await course.save();
  return res.status(200).json({
    success: true,
    message: "Course image deleted successfully",
  });
};

export async function getCourseDataById(req, res) {
  try {
    const { id } = req.params;

    // 1. Fetch course details
    const course = await Course.findById(id)
      .populate("instructors", "fname lname email _id")
      .populate("category", "category")
      .populate("subcategory", "subcategory_name")
      .populate("language", "language")
      .populate("level", "course_level");
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // 2. Fetch modules for the course
    const modules = await Module.find({ course_id: id });

    // 3. For each module, fetch lessons and populate lesson_type_id
    const modulesWithLessons = await Promise.all(
      modules.map(async (module) => {
        const lessons = await Lesson.find({ module_id: module._id }).populate(
          "lesson_type_id"
        );
        return {
          ...module.toObject(),
          lessons,
        };
      })
    );

    // 4. Return combined data
    return res.status(200).json({
      success: true,
      message: "Course data fetched successfully",
      data: {
        course,
        modules: modulesWithLessons,
      },
    });
  } catch (error) {
    console.error("Error in getCourseDataById:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching course data",
      error: error.message,
    });
  }
}
