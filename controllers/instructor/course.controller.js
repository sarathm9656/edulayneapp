import Course from "../../models/Course.js";
import Login from "../../models/login.model.js";
import User from "../../models/user.model.js";
import Module from "../../models/Module.js";
import CoursePurchase from "../../models/Course_Purchase.js";
import InstructorPricing from "../../models/instructor_pricing.js";
import Batch from "../../models/Batch_table.js";

export const getInstructorCourses = async (req, res) => {
  console.log("getInstructorCourses");

  // const id = "683d38868e3ab8f9a9302b0d";
  console.log("==============================");
  // console.log('user',req.user.id);
  console.log("==============================");

  const users = await Login.findOne({ _id: req.user.id }).populate("user_id");
  console.log("users", users);
  const id = users.user_id._id;
  const instructorLoginId = req.user.id; // This is the Login ID for the instructor
  try {
    // Get courses directly assigned to instructor
    const courseAssignedToInstructor = await Course.find({
      instructors: { $in: [id] },
    })
      .populate("category", "category")
      .populate("subcategory", "subcategory_name")
      .populate("language", "language")
      .populate("level", "course_level");

    // Get courses from batches where instructor is assigned
    const instructorBatches = await Batch.find({
      $or: [
        { instructor_id: instructorLoginId },
        { instructor_ids: instructorLoginId }
      ]
    }).populate("course_id");

    // Extract unique course IDs from batches
    const batchCourseIds = [...new Set(instructorBatches.map(batch => batch.course_id._id))];

    // Get courses from batches (excluding already fetched direct assignments)
    const batchCourses = await Course.find({
      _id: { $in: batchCourseIds },
      instructors: { $nin: [id] } // Exclude courses already in direct assignments
    })
      .populate("category", "category")
      .populate("subcategory", "subcategory_name")
      .populate("language", "language")
      .populate("level", "course_level");

    // Combine both direct assignments and batch assignments
    const allCourses = [...courseAssignedToInstructor, ...batchCourses];

    console.log("****************************************");
    console.log("Direct assigned courses:", courseAssignedToInstructor.length);
    console.log("Batch assigned courses:", batchCourses.length);
    console.log("Total courses:", allCourses.length);
    console.log("****************************************");

    // For each course, get student count and instructor details
    const coursesWithStudentCount = await Promise.all(
      allCourses.map(async (course) => {
        const studentCount = await CoursePurchase.countDocuments({
          course_id: course._id,
        });

        // Get instructor details for this course
        const instructorDetails = await Promise.all(
          course.instructors.map(async (instructorId) => {
            const instructor = await Login.findById(instructorId)
              .select("-password")
              .populate("user_id");

            if (instructor) {
              return {
                id: instructor._id,
                email: instructor.email,
                name: instructor.user_id ? `${instructor.user_id.fname} ${instructor.user_id.lname}` : "N/A",
                fname: instructor.user_id?.fname || "N/A",
                lname: instructor.user_id?.lname || "N/A",
                phone_number: instructor.user_id?.phone_number || "N/A",
                status: instructor.is_active,
                created_at: instructor.createdAt,
                updatedAt: instructor.updatedAt,
              };
            }
            return null;
          })
        );

        // Filter out null values
        const validInstructors = instructorDetails.filter(instructor => instructor !== null);

        // Check if this course is from batch assignment
        const isFromBatch = batchCourses.some(batchCourse => batchCourse._id.toString() === course._id.toString());

        // Get batch information if this course is from batch assignment
        let batchInfo = null;
        if (isFromBatch) {
          const relatedBatches = instructorBatches.filter(batch =>
            batch.course_id._id.toString() === course._id.toString()
          );
          batchInfo = relatedBatches.map(batch => ({
            batch_id: batch._id,
            batch_name: batch.batch_name,
            start_date: batch.start_date,
            end_date: batch.end_date,
            status: batch.status
          }));
        }

        return {
          ...course.toObject(),
          studentCount,
          instructors: validInstructors,
          isFromBatch,
          batchInfo
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: coursesWithStudentCount,
    });
  } catch (error) {
    console.log("Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch courses",
      error: error.message,
    });
  }
};

export const getInstructorAndDetailsById = async (req, res) => {
  console.log("getInstructorAndDetailsById");
  try {
    const { instructorId } = req.params;
    const LoginDetails = await Login.findOne({ _id: instructorId });

    if (!LoginDetails) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    const { user_id } = LoginDetails;

    const userDetails = await Promise.all([
      User.findOne({ _id: user_id }),
      Course.find({ instructors: user_id }),
      InstructorPricing.findOne({ instructor_id: LoginDetails._id }),
    ]);



    const [user, courses, pricing] = userDetails;



    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User details not found",
      });
    }

    // For each course, get module count and student count
    const coursesWithCounts = await Promise.all(
      courses.map(async (course) => {
        // Module count
        const moduleCount = await Module.countDocuments({
          course_id: course._id,
        });
        // Student count (from CoursePurchase)
        const studentCount = await CoursePurchase.countDocuments({
          course_id: course._id,
        });
        return {
          ...course.toObject(),
          moduleCount,
          studentCount,
        };
      })
    );

    // Get assigned batches
    const instructor_batches = await Batch.find({
      $or: [
        { instructor_id: instructorId },
        { instructor_ids: instructorId }
      ]
    }).select('_id batch_name course_id');

    return res.status(200).json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          price_per_hour: pricing ? pricing.price_per_hour : 0,
        },
        courses: coursesWithCounts,
        email: LoginDetails.email,
        is_active: LoginDetails.is_active,
        payment_type: pricing ? pricing.payment_type : "salary",
        payment_amount: pricing ? pricing.payment_amount : null,
        assigned_courses: pricing ? pricing.assigned_courses : [],
        assigned_batches: instructor_batches.map(b => b._id),
      },
    });
  } catch (error) {
    console.log("Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch instructor",
      error: error.message,
    });
  }
};
