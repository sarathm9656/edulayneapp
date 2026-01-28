import BatchStudent from "../../models/Batch_Students.js";
import Batch from "../../models/Batch_table.js";
import LiveSession from "../../models/Live_Session.model.js";
import CoursePurchase from "../../models/Course_Purchase.js";
import Course from "../../models/Course.js";
import Module from "../../models/Module.js";
import Lesson from "../../models/Lesson.model.js";

/**
 * Get student statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getStudentStats = async (req, res) => {
  try {
    const studentId = req.user.id; // Get student ID from authenticated user
    const tenantId = req.user.tenant_id;

    console.log("=== Student Stats Debug ===");
    console.log("studentId:", studentId);
    console.log("tenantId:", tenantId);

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required"
      });
    }

    // Get student's enrolled batches
    const enrolledBatches = await BatchStudent.find({ student_id: studentId })
      .populate({
        path: 'batch_id',
        match: { tenant_id: tenantId },
        select: 'batch_name course_id instructor_id start_date end_date status'
      })
      .sort({ joined_at: -1 });

    // Filter out batches that don't belong to the tenant
    const validBatches = enrolledBatches.filter(enrollment => enrollment.batch_id);

    console.log("Valid batches found:", validBatches.length);

    // Calculate statistics
    const totalBatches = validBatches.length;
    const completedBatches = validBatches.filter(batch =>
      batch.batch_id && batch.batch_id.status === 'completed'
    ).length;

    // Get batch IDs for live sessions query
    const batchIds = validBatches.map(batch => batch.batch_id._id);

    // Count live sessions for student's batches (only live and scheduled)
    const totalLiveSessions = batchIds.length > 0 ?
      await LiveSession.countDocuments({
        batch_id: { $in: batchIds },
        tenant_id: tenantId,
        status: { $in: ['live', 'scheduled'] }
      }) : 0;

    // Count completed live sessions
    const completedLiveSessions = batchIds.length > 0 ?
      await LiveSession.countDocuments({
        batch_id: { $in: batchIds },
        tenant_id: tenantId,
        status: 'completed'
      }) : 0;

    // Get unique course IDs from batches
    const courseIds = [...new Set(validBatches
      .filter(batch => batch.batch_id && batch.batch_id.course_id)
      .map(batch => batch.batch_id.course_id.toString())
    )];

    const totalCourses = courseIds.length;

    // Count completed courses (courses where all batches are completed)
    const completedCourses = await Promise.all(
      courseIds.map(async (courseId) => {
        const courseBatches = validBatches.filter(batch =>
          batch.batch_id && batch.batch_id.course_id.toString() === courseId
        );
        const allCompleted = courseBatches.every(batch =>
          batch.batch_id && batch.batch_id.status === 'completed'
        );
        return allCompleted ? 1 : 0;
      })
    );

    const completedCoursesCount = completedCourses.reduce((sum, count) => sum + count, 0);

    // For certificates, we'll use completed courses as a proxy
    const certificates = completedCoursesCount;

    console.log("Calculated stats:", {
      totalCourses,
      completedCourses: completedCoursesCount,
      totalLiveSessions,
      completedLiveSessions,
      totalBatches,
      completedBatches,
      certificates
    });

    res.status(200).json({
      success: true,
      data: {
        totalCourses,
        completedCourses: completedCoursesCount,
        totalLiveSessions,
        completedLiveSessions,
        totalBatches,
        completedBatches,
        certificates
      }
    });

  } catch (error) {
    console.error("Error fetching student stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get courses for student (only courses the student is enrolled in)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCourses = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { tenant_id } = req.user;

    console.log("=== getCourses Debug ===");
    console.log("req.user:", req.user);
    console.log("studentId:", studentId);
    console.log("tenant_id:", tenant_id);

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required"
      });
    }

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    console.log("Fetching enrolled courses for student:", studentId);

    // First, get the student's enrolled batches
    const enrolledBatches = await BatchStudent.find({
      student_id: studentId,
      status: { $in: ['active', 'completed'] } // Only active and completed enrollments
    }).populate({
      path: 'batch_id',
      match: { tenant_id: tenant_id },
      select: 'batch_name course_id instructor_id start_date end_date status',
      populate: {
        path: 'course_id',
        select: 'course_title course_description course_thumbnail price discounted_price duration image'
      }
    });

    // Filter out batches that don't belong to the tenant and get unique courses
    const validBatches = enrolledBatches.filter(enrollment => enrollment.batch_id);
    const uniqueCourses = [];
    const courseIds = new Set();

    validBatches.forEach(enrollment => {
      if (enrollment.batch_id.course_id && !courseIds.has(enrollment.batch_id.course_id._id.toString())) {
        courseIds.add(enrollment.batch_id.course_id._id.toString());
        uniqueCourses.push(enrollment.batch_id.course_id);
      }
    });

    console.log("Enrolled courses found:", uniqueCourses.length);
    console.log("Sample course:", uniqueCourses[0] ? JSON.stringify(uniqueCourses[0], null, 2) : "No courses found");

    res.status(200).json({
      success: true,
      message: "Enrolled courses retrieved successfully",
      data: uniqueCourses
    });

  } catch (error) {
    console.error("Error fetching enrolled courses:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get student course details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getStudentCourse = async (req, res) => {
  try {
    const { course_id } = req.params;
    const { tenant_id } = req.user;

    if (!course_id) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required"
      });
    }

    const course = await Course.findOne({
      _id: course_id,
      tenant_id: tenant_id,
      is_active: true,
      is_archived: false
    })
      .populate('category', 'category_name')
      .populate('subcategory', 'subcategory_name')
      .populate('language', 'language_name')
      .populate('level', 'level_name')
      .populate('instructors', 'fname lname email')
      .select('-__v');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    // Fetch modules and lessons
    const modules = await Module.find({ course_id })
      .sort({ display_order: 1 })
      .lean();

    const modulesWithLessons = await Promise.all(
      modules.map(async (module) => {
        const lessons = await Lesson.find({ module_id: module._id })
          .populate("lesson_type_id")
          .sort({ display_order: 1 })
          .lean();
        return { ...module, lessons };
      })
    );

    res.status(200).json({
      success: true,
      message: "Course retrieved successfully",
      data: {
        course,
        modules: modulesWithLessons
      }
    });

  } catch (error) {
    console.error("Error fetching student course:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};