import BatchStudent from "../../models/Batch_Students.js";
import Batch from "../../models/Batch_table.js";
import Login from "../../models/login.model.js";
import mongoose from "mongoose";

/**
 * Add student to batch
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const addStudentToBatch = async (req, res) => {
  try {
    const { batch_id, student_id, status } = req.body;
    const tenant_id = req.user.tenant_id;

    // Validate required fields
    if (!batch_id || !student_id) {
      return res.status(400).json({
        success: false,
        message: "batch_id and student_id are required"
      });
    }

    // Validate tenant_id from user
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    // Check if batch exists and belongs to tenant
    const batch = await Batch.findOne({ _id: batch_id, tenant_id }).populate('course_id');
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found or access denied"
      });
    }

    // Enrollment timing and status checks
    const currentDate = new Date();

    if (new Date(batch.end_date) < currentDate) {
      return res.status(400).json({
        success: false,
        message: "Cannot enroll student. This batch has already ended."
      });
    }

    if (!batch.course_id || !batch.course_id.is_active) {
      return res.status(400).json({
        success: false,
        message: "Cannot enroll student. The associated course is inactive or expired."
      });
    }

    // Check capacity (total students across all batches of this course)
    const batchIdsForCourse = await Batch.find({ course_id: batch.course_id._id }).distinct('_id');
    const totalEnrollments = await BatchStudent.countDocuments({
      batch_id: { $in: batchIdsForCourse },
      status: { $ne: 'dropped' } // Don't count dropped students
    });

    if (batch.course_id.max_enrollment && totalEnrollments >= batch.course_id.max_enrollment) {
      return res.status(400).json({
        success: false,
        message: `Course capacity reached. Max students: ${batch.course_id.max_enrollment}`
      });
    }

    // Check if student is already enrolled in this batch
    const existingEnrollment = await BatchStudent.findOne({
      batch_id,
      student_id
    });

    if (existingEnrollment) {
      return res.status(409).json({
        success: false,
        message: "Student is already enrolled in this batch"
      });
    }

    // Create new batch student enrollment
    const newBatchStudent = new BatchStudent({
      batch_id,
      student_id,
      status: status || "active"
    });

    const savedBatchStudent = await newBatchStudent.save();

    // Populate references for better response
    await savedBatchStudent.populate([
      { path: 'batch_id', select: 'batch_name course_id instructor_id start_date end_date status' },
      { path: 'student_id', select: 'name email' }
    ]);

    return res.status(201).json({
      success: true,
      message: "Student added to batch successfully",
      data: savedBatchStudent
    });

  } catch (error) {
    console.error("Error adding student to batch:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get all students in a batch
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getBatchStudents = async (req, res) => {
  try {
    const { batch_id } = req.params;
    const tenant_id = req.user.tenant_id;

    // Validate tenant_id from user
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    // Check if batch exists and belongs to tenant
    const batch = await Batch.findOne({ _id: batch_id, tenant_id });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found or access denied"
      });
    }

    const batchStudents = await BatchStudent.find({ batch_id })
      .populate('batch_id', 'batch_name course_id instructor_id start_date end_date status')
      .populate('student_id', 'name email')
      .sort({ joined_at: -1 });

    return res.status(200).json({
      success: true,
      message: "Batch students retrieved successfully",
      data: batchStudents
    });

  } catch (error) {
    console.error("Error fetching batch students:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get student's batch enrollments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getStudentBatches = async (req, res) => {
  try {
    const { student_id } = req.params;
    const tenant_id = req.user.tenant_id;

    // Validate tenant_id from user
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    const studentBatches = await BatchStudent.find({ student_id })
      .populate({
        path: 'batch_id',
        match: { tenant_id },
        select: 'batch_name course_id instructor_id start_date end_date status'
      })
      .populate('student_id', 'name email')
      .sort({ joined_at: -1 });

    // Filter out batches that don't belong to the tenant
    const filteredBatches = studentBatches.filter(enrollment => enrollment.batch_id);

    return res.status(200).json({
      success: true,
      message: "Student batches retrieved successfully",
      data: filteredBatches
    });

  } catch (error) {
    console.error("Error fetching student batches:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update batch student status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateBatchStudentStatus = async (req, res) => {
  try {
    const { batch_id, student_id } = req.params;
    const { status } = req.body;
    const tenant_id = req.user.tenant_id;

    // Validate tenant_id from user
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    // Validate status
    const validStatuses = ["active", "dropped", "completed", "suspended"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required. Must be one of: active, dropped, completed, suspended"
      });
    }

    // Check if batch exists and belongs to tenant
    const batch = await Batch.findOne({ batch_id, tenant_id });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found or access denied"
      });
    }

    const updatedBatchStudent = await BatchStudent.findOneAndUpdate(
      { batch_id, student_id },
      { status },
      { new: true, runValidators: true }
    ).populate([
      { path: 'batch_id', select: 'batch_name course_id instructor_id start_date end_date status' },
      { path: 'student_id', select: 'name email' }
    ]);

    if (!updatedBatchStudent) {
      return res.status(404).json({
        success: false,
        message: "Student enrollment not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: `Student status updated to ${status} successfully`,
      data: updatedBatchStudent
    });

  } catch (error) {
    console.error("Error updating batch student status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Remove student from batch
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const removeStudentFromBatch = async (req, res) => {
  try {
    const { batch_id, student_id } = req.params;
    const tenant_id = req.user.tenant_id;

    // Validate tenant_id from user
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    // Check if batch exists and belongs to tenant
    const batch = await Batch.findOne({ _id: batch_id, tenant_id });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found or access denied"
      });
    }

    const deletedBatchStudent = await BatchStudent.findOneAndDelete({
      batch_id,
      student_id
    });

    if (!deletedBatchStudent) {
      return res.status(404).json({
        success: false,
        message: "Student enrollment not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student removed from batch successfully"
    });

  } catch (error) {
    console.error("Error removing student from batch:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get batch students by status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getBatchStudentsByStatus = async (req, res) => {
  try {
    const { batch_id, status } = req.params;
    const tenant_id = req.user.tenant_id;

    // Validate tenant_id from user
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    // Validate status
    const validStatuses = ["active", "dropped", "completed", "suspended"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: active, dropped, completed, suspended"
      });
    }

    // Check if batch exists and belongs to tenant
    const batch = await Batch.findOne({ _id: batch_id, tenant_id });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found or access denied"
      });
    }

    const batchStudents = await BatchStudent.find({ batch_id, status })
      .populate('batch_id', 'batch_name course_id instructor_id start_date end_date status')
      .populate('student_id', 'name email')
      .sort({ joined_at: -1 });

    return res.status(200).json({
      success: true,
      message: `${status} students in batch retrieved successfully`,
      data: batchStudents
    });

  } catch (error) {
    console.error("Error fetching batch students by status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get batch student statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getBatchStudentStatistics = async (req, res) => {
  try {
    const { batch_id } = req.params;
    const tenant_id = req.user.tenant_id;

    // Validate tenant_id from user
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    // Check if batch exists and belongs to tenant
    const batch = await Batch.findOne({ _id: batch_id, tenant_id });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found or access denied"
      });
    }

    const stats = await BatchStudent.aggregate([
      { $match: { batch_id: new mongoose.Types.ObjectId(batch_id) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Format the statistics
    const formattedStats = {
      active: 0,
      dropped: 0,
      completed: 0,
      suspended: 0,
      total: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    return res.status(200).json({
      success: true,
      message: "Batch student statistics retrieved successfully",
      data: formattedStats
    });

  } catch (error) {
    console.error("Error getting batch student statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Bulk add students to batch
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const bulkAddStudentsToBatch = async (req, res) => {
  try {
    const { batch_id, student_ids, status } = req.body;
    const tenant_id = req.user.tenant_id;

    // Validate required fields
    if (!batch_id || !student_ids || !Array.isArray(student_ids)) {
      return res.status(400).json({
        success: false,
        message: "batch_id and student_ids array are required"
      });
    }

    // Validate tenant_id from user
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    // Check if batch exists and belongs to tenant
    const batch = await Batch.findOne({ _id: batch_id, tenant_id }).populate('course_id');
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found or access denied"
      });
    }

    // Enrollment timing and status checks
    const currentDate = new Date();
    if (new Date(batch.end_date) < currentDate) {
      return res.status(400).json({
        success: false,
        message: "Cannot enroll students. This batch has already ended."
      });
    }

    if (!batch.course_id || !batch.course_id.is_active) {
      return res.status(400).json({
        success: false,
        message: "Cannot enroll students. The associated course is inactive or expired."
      });
    }

    // Check capacity
    const batchIdsForCourse = await Batch.find({ course_id: batch.course_id._id }).distinct('_id');
    const totalEnrollments = await BatchStudent.countDocuments({
      batch_id: { $in: batchIdsForCourse },
      status: { $ne: 'dropped' }
    });

    if (batch.course_id.max_enrollment && (totalEnrollments + student_ids.length) > batch.course_id.max_enrollment) {
      return res.status(400).json({
        success: false,
        message: `Bulk enrollment would exceed course capacity. Available spots: ${batch.course_id.max_enrollment - totalEnrollments}`
      });
    }

    const results = {
      added: [],
      alreadyEnrolled: [],
      errors: []
    };

    for (const student_id of student_ids) {
      try {
        // Check if student is already enrolled
        const existingEnrollment = await BatchStudent.findOne({
          batch_id,
          student_id
        });

        if (existingEnrollment) {
          results.alreadyEnrolled.push(student_id);
          continue;
        }

        // Create new enrollment
        const newBatchStudent = new BatchStudent({
          batch_id,
          student_id,
          status: status || "active"
        });

        const savedBatchStudent = await newBatchStudent.save();
        await savedBatchStudent.populate([
          { path: 'batch_id', select: 'batch_name course_id instructor_id start_date end_date status' },
          { path: 'student_id', select: 'name email' }
        ]);

        results.added.push(savedBatchStudent);
      } catch (error) {
        results.errors.push({ student_id, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Bulk operation completed",
      data: results
    });

  } catch (error) {
    console.error("Error in bulk add students to batch:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Search batch students
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const searchBatchStudents = async (req, res) => {
  try {
    const { batch_id } = req.params;
    const { searchValue } = req.query;
    const tenant_id = req.user.tenant_id;

    // Validate tenant_id from user
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    // Check if batch exists and belongs to tenant
    const batch = await Batch.findOne({ _id: batch_id, tenant_id });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found or access denied"
      });
    }

    const batchStudents = await BatchStudent.find({ batch_id })
      .populate({
        path: 'student_id',
        match: {
          $or: [
            { name: { $regex: searchValue, $options: 'i' } },
            { email: { $regex: searchValue, $options: 'i' } }
          ]
        },
        select: 'name email'
      })
      .populate('batch_id', 'batch_name course_id instructor_id start_date end_date status')
      .sort({ joined_at: -1 });

    // Filter out students that don't match the search
    const filteredStudents = batchStudents.filter(enrollment => enrollment.student_id);

    return res.status(200).json({
      success: true,
      message: "Batch students search completed successfully",
      data: filteredStudents
    });

  } catch (error) {
    console.error("Error searching batch students:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};


export const getStudentEnrolledBatches = async (req, res) => {
  try {
    const login_id = req.user.id; // Get login ID from authenticated user

    console.log("=== DEBUG START ===");
    console.log("req.user:", req.user);
    console.log("login_id from req.user.id:", login_id);

    if (!login_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Find BatchStudent records using login_id as student_id
    const studentBatches = await BatchStudent.find({ student_id: login_id })
      .populate({
        path: 'batch_id',
        select: 'batch_name course_id instructor_id instructor_ids start_date end_date status subscription_price currency subscription_enabled recurring_days batch_time meeting_link meeting_platform',
        populate: [
          {
            path: 'course_id',
            select: 'course_title course_description course_thumbnail price discounted_price duration'
          },
          {
            path: 'instructor_id',
            select: 'email',
            populate: {
              path: 'user_id',
              select: 'fname lname'
            }
          },
          {
            path: 'instructor_ids',
            select: 'email',
            populate: {
              path: 'user_id',
              select: 'fname lname'
            }
          }
        ]
      })
      .sort({ joined_at: -1 });

    console.log("Raw studentBatches:", studentBatches);
    console.log("Number of enrollments found:", studentBatches.length);

    // Check for orphaned records (enrollments with null batch_id)
    const orphanedEnrollments = studentBatches.filter(enrollment => !enrollment.batch_id);
    if (orphanedEnrollments.length > 0) {
      console.log("Found orphaned enrollments:", orphanedEnrollments.length);
      // Optionally, you can clean up orphaned records here
      // await BatchStudent.deleteMany({ _id: { $in: orphanedEnrollments.map(e => e._id) } });
    }

    console.log("@@@@@@@@@@@@@@@");
    console.log("studentBatches after population:", studentBatches);
    console.log("@@@@@@@@@@@@@@@");

    // Transform the data to match frontend expectations
    const transformedBatches = studentBatches
      .filter(enrollment => enrollment.batch_id) // Filter out enrollments with null batch_id
      .map(enrollment => ({
        _id: enrollment._id,
        batch_id: enrollment.batch_id._id,
        batch_name: enrollment.batch_id.batch_name,
        course_id: enrollment.batch_id.course_id,
        instructor_id: enrollment.batch_id.instructor_id,
        instructor_ids: enrollment.batch_id.instructor_ids,
        start_date: enrollment.batch_id.start_date,
        end_date: enrollment.batch_id.end_date,
        status: enrollment.batch_id.status,
        subscription_price: enrollment.batch_id.subscription_price,
        currency: enrollment.batch_id.currency,
        subscription_enabled: enrollment.batch_id.subscription_enabled,
        enrollment_status: enrollment.status,
        progress: enrollment.progress,
        joined_at: enrollment.joined_at,
        recurring_days: enrollment.batch_id.recurring_days,
        batch_time: enrollment.batch_id.batch_time,
        meeting_link: enrollment.batch_id.meeting_link,
        meeting_platform: enrollment.batch_id.meeting_platform
      }));

    return res.status(200).json({
      success: true,
      message: transformedBatches.length
        ? "Student enrolled batches retrieved successfully"
        : "No batches found for this student",
      batches: transformedBatches
    });

  } catch (error) {
    console.error("Error fetching student enrolled batches:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};


/**
 * Get batch student count
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getBatchStudentCount = async (req, res) => {
  try {
    const { batch_id } = req.params;
    const tenant_id = req.user.tenant_id;

    // Validate tenant_id from user
    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required"
      });
    }

    // Check if batch exists and belongs to tenant
    const batch = await Batch.findOne({ _id: batch_id, tenant_id });
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found or access denied"
      });
    }

    const count = await BatchStudent.countDocuments({ batch_id });

    return res.status(200).json({
      success: true,
      message: "Batch student count retrieved successfully",
      data: { count }
    });

  } catch (error) {
    console.error("Error getting batch student count:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
