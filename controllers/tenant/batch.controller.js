import Batch from "../../models/Batch_table.js";
import Course from "../../models/Course.js";
import Login from "../../models/login.model.js";
import User from "../../models/user.model.js";
import Role from "../../models/role.model.js";
import BatchStudent from "../../models/Batch_Students.js";
import axios from 'axios';
import { findBatchConflict } from "../../utils/batchConflict.js";
import CoursePurchase from "../../models/Course_Purchase.js";

// Dyte API Configuration
const DYTE_API_BASE_URL = 'https://api.dyte.io/v2';
const getDyteAuth = () => {
  const orgId = process.env.DYTE_ORG_ID;
  const apiKey = process.env.DYTE_API_KEY;
  return Buffer.from(`${orgId}:${apiKey}`).toString('base64');
};

export const createBatch = async (req, res) => {
  try {
    const { course_id, batch_name, instructor_id, start_date, end_date, ...otherData } =
      req.body;
    const { tenant_id } = req.user;

    if (
      !course_id ||
      !batch_name ||
      !instructor_id ||
      !start_date ||
      !end_date ||
      !tenant_id
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    // 1. Create Dyte Meeting for this Batch
    // MOVED: Meeting creation is now deferred until the first "Start Class" action.
    // This prevents students from joining an empty meeting before the instructor is ready.
    let dyteMeetingId = null;
    let meetingLink = "";

    /* 
    try {
      const dyteResponse = await axios.post(
        `${DYTE_API_BASE_URL}/meetings`,
        {
          title: `Batch: ${batch_name}`,
          preferred_region: 'ap-south-1',
          record_on_start: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${getDyteAuth()}`,
          },
        }
      );

      if (dyteResponse.data && dyteResponse.data.data) {
        dyteMeetingId = dyteResponse.data.data.id;
        meetingLink = `https://app.dyte.io/meeting/${dyteMeetingId}`;
      }
    } catch (dyteError) {
      console.error("Error creating Dyte meeting for batch:", dyteError.response?.data || dyteError.message);
    }
    */

    const batch = new Batch({
      tenant_id,
      course_id,
      batch_name,
      instructor_id,
      start_date,
      end_date,
      meeting_link: meetingLink,
      meeting_platform: "Dyte",
      ...otherData
    });
    await batch.save();

    // Populate references for better response
    await batch.populate([
      { path: "tenant_id", select: "name" },
      { path: "course_id", select: "course_title" },
      {
        path: "instructor_id",
        select: "email",
        populate: {
          path: "user_id",
          select: "fname lname",
        },
      },
    ]);

    return res.status(201).json({
      success: true,
      message: "Batch created successfully with Dyte meeting link.",
      data: batch,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create batch.",
      error: error.message,
    });
  }
};



export const getStudentsForBatch = async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { batch_id } = req.params;

    if (!tenant_id || !batch_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID and Batch ID are required",
      });
    }

    // Step 0: Get Batch to find Course ID
    const batch = await Batch.findById(batch_id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    // Step 1: Find users enrolled in the course (CoursePurchase)
    const coursePurchases = await CoursePurchase.find({
      course_id: batch.course_id,
      tenant_id: tenant_id, // Ensure tenant isolation
    }).distinct('user_id'); // Get distinct user_ids

    // If no one bought the course, return empty
    if (!coursePurchases || coursePurchases.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No students enrolled in the course associated with this batch",
        all_students: [],
        batchStudents: [],
        all_count: 0,
        batchStudentsCount: 0,
      });
    }

    // Step 2: Get student role_id from Role model
    const studentRole = await Role.findOne({ name: "student" });

    if (!studentRole) {
      return res.status(404).json({
        success: false,
        message: "Student role not found",
      });
    }

    const studentRoleId = studentRole._id;

    // Step 3: Get login data from Login model based on role_id, tenant_id AND course enrollment
    const loginRecords = await Login.find({
      role_id: studentRoleId,
      tenant_id: tenant_id,
      user_id: { $in: coursePurchases } // Filter by enrolled users
    }).populate("user_id");

    if (!loginRecords || loginRecords.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No students found for this tenant",
        all_students: [],
        batchStudents: [],
      });
    }

    // Step 4: Extract user_ids and fetch complete user data from User model
    const userIds = loginRecords.map((login) => login.user_id?._id).filter(Boolean);
    const students = await User.find({
      _id: { $in: userIds },
    });

    // Step 5: Combine the data for all students
    const allStudentData = students.map((student) => {
      const loginRecord = loginRecords.find(
        (login) => login.user_id?._id?.toString() === student._id.toString()
      );

      return {
        _id: student._id, // Use User ID as primary ID
        login_id: loginRecord?._id, // Include Login ID for enrollment
        fname: student.fname,
        lname: student.lname,
        email: student.email,
        phone_number: student.phone_number,
        age: student.age,
        dob: student.dob,
        tenant_id: tenant_id,
        role_id: studentRoleId,
        is_active: loginRecord ? loginRecord.is_active : false,
        user_code: student.user_code,
        created_at: student.createdAt,
        updated_at: student.updatedAt,
      };
    });

    // Step 6: Get batch students
    const batchStudents = await BatchStudent.find({
      batch_id: batch_id,
    }).populate({
      path: "student_id",
      populate: {
        path: "user_id",
        select: "fname lname email phone_number user_code"
      }
    });

    // Convert batch students to match expected format
    const batchStudentsData = batchStudents
      .filter((enrollment) => enrollment.student_id) // Filter out enrollments with null student_id
      .map((enrollment) => {
        const studentData = allStudentData.find(
          (student) =>
            // Fix comparison: enrollment.student_id is likely the Login object (since it was populated), so compare its _id
            // But wait, in previous code it said student_id might be null.
            // In BatchStudent model, student_id refs Login.
            // If populated, enrollment.student_id is an object.
            // studentData has login_id (which is Login._id).
            // So we compare studentData.login_id with enrollment.student_id._id
            student.login_id.toString() === enrollment.student_id._id.toString()
        );

        return {
          _id: enrollment._id,
          batch_id: enrollment.batch_id,
          student_id: enrollment.student_id._id, // Login ID
          user_id: enrollment.student_id.user_id?._id, // User ID (deep populated)
          joined_at: enrollment.joined_at,
          status: enrollment.status,
          progress: enrollment.progress,
          student_data: enrollment.student_id,
        };
      });

    return res.status(200).json({
      success: true,
      message: "Students fetched successfully",
      all_students: allStudentData,
      batchStudents: batchStudentsData,
      all_count: allStudentData.length,
      batchStudentsCount: batchStudentsData.length,
    });
  } catch (error) {
    console.error("Error fetching students for batch:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch students for batch",
      error: error.message,
    });
  }
};

export const enrollStudents = async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { batch_id } = req.params;
    const { courseStudents } = req.body; // array of objects: [{ login_id }]

    console.log("Batch enrollment request:", { batch_id, courseStudents });

    if (!tenant_id || !batch_id || !Array.isArray(courseStudents)) {
      return res.status(400).json({
        success: false,
        message: "Missing tenant_id, batch_id, or courseStudents array",
      });
    }

    // First, get the batch details to check if it exists and belongs to tenant
    const batch = await Batch.findById(batch_id).populate('course_id');
    console.log("batch found", batch);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found or access denied",
      });
    }

    // NEW: Enrollment timing and status checks
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

    // Capacity check across all batches of this course
    const batchIdsForCourse = await Batch.find({ course_id: batch.course_id._id }).distinct('_id');
    const totalEnrollments = await BatchStudent.countDocuments({
      batch_id: { $in: batchIdsForCourse },
      status: { $ne: 'dropped' }
    });

    if (batch.course_id.max_enrollment && (totalEnrollments + courseStudents.length) > batch.course_id.max_enrollment) {
      return res.status(400).json({
        success: false,
        message: `Enrollment would exceed course capacity. Max: ${batch.course_id.max_enrollment}, Current: ${totalEnrollments}`
      });
    }

    // Get current enrollment count for this batch
    const currentEnrollmentCount = await BatchStudent.countDocuments({
      batch_id: batch_id,
    });

    console.log("currentEnrollmentCount", currentEnrollmentCount);
    // Extract login_ids from courseStudents (frontend sends login_id)
    const loginIds = courseStudents.map((obj) => obj.login_id);

    // Find already enrolled students for this batch
    const alreadyEnrolled = await BatchStudent.find({
      batch_id: batch_id,
    }).distinct("student_id");

    console.log("Already enrolled students:", alreadyEnrolled);
    console.log("Requested students:", loginIds);

    // Filter out already enrolled students
    const newLoginIds = loginIds.filter((id) => !alreadyEnrolled.includes(id.toString()));
    const alreadyEnrolledRequested = loginIds.filter((id) => alreadyEnrolled.includes(id.toString()));

    console.log("New students to enroll:", newLoginIds);
    console.log("Already enrolled from request:", alreadyEnrolledRequested);

    // Check if adding new students would exceed max_enrollment (if batch has a limit)
    // You can add batch enrollment limit logic here if needed
    // const newEnrollmentCount = currentEnrollmentCount + newLoginIds.length;
    // if (batch.max_enrollment && newEnrollmentCount > batch.max_enrollment) {
    //   return res.status(400).json({
    //     success: false,
    //     message: `Cannot enroll students. Batch has a maximum enrollment limit of ${batch.max_enrollment}.`
    //   });
    // }

    const now = new Date();

    // Prepare docs for new batch enrollments
    const batchStudentDocs = newLoginIds.map((loginId) => ({
      batch_id: batch_id,
      student_id: loginId, // This should be the login_id (reference to Login model)
      joined_at: now,
      status: "active",
    }));

    console.log("Preparing to insert enrollments:", batchStudentDocs.length);

    // Insert only new enrollments (one by one to avoid duplicates)
    let inserted = [];
    let errors = [];
    if (batchStudentDocs.length > 0) {
      for (const enrollmentDoc of batchStudentDocs) {
        try {
          // Check if enrollment already exists
          const existingEnrollment = await BatchStudent.findOne({
            batch_id: enrollmentDoc.batch_id,
            student_id: enrollmentDoc.student_id,
          });

          if (!existingEnrollment) {
            // Check for schedule conflicts
            const studentActiveEnrollments = await BatchStudent.find({
              student_id: enrollmentDoc.student_id,
              status: "active"
            }).populate("batch_id");

            const existingBatches = studentActiveEnrollments
              .map(e => e.batch_id)
              .filter(b => b && b._id.toString() !== batch_id); // Filter out current batch if somehow present and nulls

            const conflict = findBatchConflict(batch, existingBatches);

            if (conflict) {
              console.log(`Schedule conflict for student ${enrollmentDoc.student_id}: Overlaps with batch ${conflict.batch_name}`);
              errors.push(`Student skipped: Schedule conflict with batch "${conflict.batch_name}"`);
              continue;
            }

            const result = await BatchStudent.create(enrollmentDoc);
            inserted.push(result.student_id);
            console.log("Enrolled student:", result.student_id);
          } else {
            console.log("Student already enrolled:", enrollmentDoc.student_id);
            alreadyEnrolledRequested.push(enrollmentDoc.student_id);
          }
        } catch (err) {
          console.log("Error enrolling student:", enrollmentDoc.student_id, err.message);
          errors.push(`Failed to enroll student ${enrollmentDoc.student_id}: ${err.message}`);
        }
      }
      console.log("Successfully inserted enrollments:", inserted);
    } else {
      console.log("No new enrollments to insert");
    }

    // Remove enrollments for students NOT in courseStudents (unenroll students)
    const unenrolledResult = await BatchStudent.deleteMany({
      batch_id: batch_id,
      student_id: { $nin: loginIds },
    });
    console.log("Unenrolled students count:", unenrolledResult.deletedCount);

    // Get updated enrollment count
    const updatedEnrollmentCount = await BatchStudent.countDocuments({
      batch_id: batch_id,
    });

    return res.status(200).json({
      success: true,
      message: `Batch enrollment updated successfully. ${inserted.length} new enrollments, ${alreadyEnrolledRequested.length} already enrolled, ${unenrolledResult.deletedCount} unenrolled.${errors.length > 0 ? ` ${errors.length} errors/conflicts.` : ''}`,
      enrolled_students: inserted,
      skipped_students: alreadyEnrolledRequested,
      unenrolled_count: unenrolledResult.deletedCount,
      currentEnrollment: updatedEnrollmentCount,
      maxEnrollment: batch.max_enrollment || null,
      batch_name: batch.batch_name,
      errors,
    });
  } catch (error) {
    console.error("Batch enrollment error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while enrolling students in batch",
      error: error.message,
    });
  }
};
