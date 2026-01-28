import Login from "../../models/login.model.js";
import InstructorPricing from "../../models/instructor_pricing.js";
import Course from "../../models/Course.js";
import CoursePurchase from "../../models/Course_Purchase.js";
import Batch from "../../models/Batch_table.js";
import LiveSession from "../../models/Live_Session.model.js";
import BatchStudent from "../../models/Batch_Students.js";

export const getAllInstructors = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;

    const instructors = await Login.find({
      tenant_id: tenant_id,
    })
      .populate("user_id role_id")
      .select("-password")
      .sort({ createdAt: -1 });

    const filteredInstructors = instructors.filter(
      (instructor) => instructor.role_id?.name === "instructor"
    );

    const organizedInstructors = await Promise.all(
      filteredInstructors.map(async (instructor) => {
        // Get pricing information for this instructor
        const pricing = await InstructorPricing.findOne({
          instructor_id: instructor._id,
        });

        // Get assigned batches
        const instructor_batches = await Batch.find({
          tenant_id: tenant_id,
          $or: [
            { instructor_id: instructor._id },
            { instructor_ids: instructor._id }
          ]
        }).select('_id batch_name course_id');

        return {
          id: instructor._id,
          email: instructor.email,
          name: instructor.user_id.fname + " " + instructor.user_id.lname,
          fname: instructor.user_id.fname,
          lname: instructor.user_id.lname,
          role: instructor.role_id.name,
          role_id: instructor.role_id._id,
          phone_number: instructor.user_id.phone_number,
          dob: instructor.user_id.dob,
          age: instructor.user_id.age,
          user_id: instructor.user_id._id,
          status: instructor.is_active,
          price_per_hour: pricing ? pricing.price_per_hour : null,
          payment_type: pricing ? pricing.payment_type : "salary",
          payment_amount: pricing ? pricing.payment_amount : null,
          assigned_courses: pricing ? pricing.assigned_courses : [],
          assigned_batches: instructor_batches.map(b => b._id),
          gender: instructor.user_id.gender,
          address: instructor.user_id.address,
          bio: instructor.user_id.bio,
          profile_image: instructor.user_id.profile_image,
          user_code: instructor.user_id.user_code,
          created_at: instructor.createdAt,
          updatedAt: instructor.updatedAt,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: organizedInstructors,
    });
  } catch (error) {
    console.error("Error in getAllInstructors:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const searchInstructor = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const searchValue = req.params.searchValue || "";

    const instructors = await Login.find({
      tenant_id: tenant_id,
    })
      .populate("user_id role_id")
      .sort({ createdAt: -1 });

    const filteredInstructors = instructors.filter(
      (instructor) =>
        instructor.role_id && instructor.role_id.name === "instructor"
    );

    let finalFiltered = filteredInstructors;
    if (searchValue !== "") {
      finalFiltered = filteredInstructors.filter(
        (instructor) =>
          instructor.user_id.fname
            .toLowerCase()
            .includes(searchValue.toLowerCase()) ||
          instructor.user_id.lname
            .toLowerCase()
            .includes(searchValue.toLowerCase()) ||
          instructor.email.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    const organizedInstructors = await Promise.all(
      finalFiltered.map(async (instructor) => {
        // Get pricing information for this instructor
        const pricing = await InstructorPricing.findOne({
          instructor_id: instructor._id,
        });

        // Get assigned batches
        const instructor_batches = await Batch.find({
          tenant_id: tenant_id,
          $or: [
            { instructor_id: instructor._id },
            { instructor_ids: instructor._id }
          ]
        }).select('_id');

        return {
          id: instructor._id,
          email: instructor.email,
          name: instructor.user_id.fname + " " + instructor.user_id.lname,
          fname: instructor.user_id.fname,
          lname: instructor.user_id.lname,
          role: instructor.role_id.name,
          role_id: instructor.role_id._id,
          phone_number: instructor.user_id.phone_number,
          dob: instructor.user_id.dob,
          age: instructor.user_id.age,
          user_id: instructor.user_id._id,
          status: instructor.is_active,
          price_per_hour: pricing ? pricing.price_per_hour : null,
          payment_type: pricing ? pricing.payment_type : "salary",
          payment_amount: pricing ? pricing.payment_amount : null,
          assigned_courses: pricing ? pricing.assigned_courses : [],
          assigned_batches: instructor_batches.map(b => b._id),
          gender: instructor.user_id.gender,
          address: instructor.user_id.address,
          bio: instructor.user_id.bio,
          profile_image: instructor.user_id.profile_image,
          user_code: instructor.user_id.user_code,
          created_at: instructor.createdAt,
          updatedAt: instructor.updatedAt,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: organizedInstructors,
    });
  } catch (error) {
    console.error("Error in searchInstructor:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getCourseDetailsById = async (req, res) => {
  try {
    const courseId = req.params.id;
    const courseDetails = await Course.findById(courseId)
      .populate("level")
      .populate("category")
      .populate("language")
      .populate("subcategory");

    console.log(courseDetails, "courseDetails=========  ");

    // Properly populate instructor details
    const instructorDetails = await Promise.all(
      courseDetails?.instructors.map(async (instructorId) => {
        const instructor = await Login.findById(instructorId)
          .select("-password")
          .populate("user_id");

        if (instructor) {
          return {
            id: instructor._id,
            email: instructor.email,
            name: instructor.user_id
              ? `${instructor.user_id.fname} ${instructor.user_id.lname}`
              : "N/A",
            fname: instructor.user_id?.fname || "N/A",
            lname: instructor.user_id?.lname || "N/A",
            phone_number: instructor.user_id?.phone_number || "N/A",
            status: instructor.is_active,
            created_at: instructor.createdAt,
            updatedAt: instructor.updatedAt,
          };
        }
        return null;
      }) || []
    );

    // Filter out null values
    const validInstructors = instructorDetails.filter(
      (instructor) => instructor !== null
    );

    console.log(validInstructors, "instructorDetails=========  ");

    const courseDetailsWithInstructor = {
      ...courseDetails.toObject(),
      instructors: validInstructors,
    };

    console.log(courseDetailsWithInstructor, "courseDetailsWithInstructor");

    res.status(200).json({
      success: true,
      data: courseDetailsWithInstructor,
    });
  } catch (error) {
    console.error("Error in getCourseDetailsById:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getInstructorStats = async (req, res) => {
  try {
    const { id: instructorId } = req.user; // Get instructor ID from authenticated user
    console.log(instructorId, "instructorId");

    if (!instructorId) {
      return res.status(400).json({
        success: false,
        message: "Instructor ID is required",
      });
    }

    // Get instructor details
    const instructor = await Login.findById(instructorId).populate("user_id");

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    const userId = instructor.user_id._id;

    // Get instructor's assigned batches (both primary and secondary)
    const instructorBatches = await Batch.find({
      $or: [{ instructor_id: instructorId }, { instructor_ids: instructorId }],
      tenant_id: req.user.tenant_id,
    }).select("_id course_id");

    const instructorBatchIds = instructorBatches.map((batch) => batch._id);
    const batchCourseIds = instructorBatches.map((batch) => batch.course_id);

    console.log(
      "Debug - Instructor stats - Batch count:",
      instructorBatchIds.length
    );
    console.log("Debug - Instructor stats - Batch IDs:", instructorBatchIds);

    // Get counts using Promise.all for better performance
    const [
      directCourses,
      activeDirectCourses,
      batchCourses,
      activeBatchCourses,
      totalStudents,
      totalBatches,
      totalLiveSessions,
    ] = await Promise.all([
      // Count total courses directly assigned to this instructor
      Course.countDocuments({
        instructors: userId,
        is_archived: false,
      }),

      // Count active courses directly assigned to this instructor
      Course.countDocuments({
        instructors: userId,
        is_active: true,
        is_archived: false,
      }),

      // Count courses from batches (excluding direct assignments)
      Course.countDocuments({
        _id: { $in: batchCourseIds },
        instructors: { $nin: [userId] },
        is_archived: false,
      }),

      // Count active courses from batches
      Course.countDocuments({
        _id: { $in: batchCourseIds },
        instructors: { $nin: [userId] },
        is_active: true,
        is_archived: false,
      }),

      // Count total students across all instructor's courses (both direct and batch)
      CoursePurchase.countDocuments({
        course_id: {
          $in: await Course.find({
            $or: [{ instructors: userId }, { _id: { $in: batchCourseIds } }],
          }).distinct("_id"),
        },
      }),

      // Count total batches assigned to this instructor
      Batch.countDocuments({
        $or: [
          { instructor_id: instructorId },
          { instructor_ids: instructorId },
        ],
      }),

      // Count live sessions for instructor's batches (only scheduled and ongoing)
      instructorBatchIds.length > 0
        ? LiveSession.countDocuments({
          batch_id: { $in: instructorBatchIds },
          status: { $in: ["scheduled", "ongoing"] },
        })
        : 0,
    ]);

    const totalCourses = directCourses + batchCourses;
    const activeCourses = activeDirectCourses + activeBatchCourses;

    res.status(200).json({
      success: true,
      data: {
        totalCourses,
        activeCourses,
        totalStudents,
        totalBatches,
        totalLiveSessions,
      },
    });
  } catch (error) {
    console.error("Error fetching instructor stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch instructor statistics",
      error: error.message,
    });
  }
};

export const getStudentsByBatch = async (req, res) => {
  try {
    // Get all batches for the instructor
    const allBatches = await Batch.find({
      instructor_id: req.user.id || req.user._id,
      tenant_id: req.user.tenant_id,
    }).populate('course_id', 'title description');

    const batchIds = allBatches.map((batch) => batch._id);

    // Get all students enrolled in these batches with complete data
    const batchStudents = await BatchStudent.find({
      batch_id: { $in: batchIds },
    })
      .populate({
        path: 'student_id',
        populate: {
          path: 'user_id',
          model: 'User'
        }
      })
      .populate({
        path: 'batch_id',
        populate: {
          path: 'course_id',
          model: 'Course',
          select: 'title description'
        }
      });

    // Group students by batch for better organization
    const studentsByBatch = allBatches.map(batch => {
      const batchStudentsList = batchStudents.filter(bs => bs.batch_id._id.toString() === batch._id.toString());

      return {
        batch_id: batch._id,
        batch_name: batch.batch_name,
        course_title: batch.course_id?.title || 'N/A',
        course_description: batch.course_id?.description || 'N/A',
        start_date: batch.start_date,
        end_date: batch.end_date,
        status: batch.status,
        students: batchStudentsList.map(bs => ({
          _id: bs._id,
          student_id: bs.student_id,
          joined_at: bs.joined_at,
          status: bs.status,
          progress: bs.progress,
          student_details: {
            _id: bs.student_id._id,
            email: bs.student_id.email,
            is_active: bs.student_id.is_active,
            last_login: bs.student_id.last_login,
            user_id: bs.student_id.user_id
          }
        }))
      };
    });

    // Calculate total students across all batches
    const totalStudents = batchStudents.length;

    res.status(200).json({
      success: true,
      data: {
        students_by_batch: studentsByBatch,
        total_students: totalStudents,
        total_batches: allBatches.length
      }
    });
  } catch (error) {
    console.error("Error fetching students by batch:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
