import Login from "../../models/login.model.js";
import User from "../../models/user.model.js";
import sendMail from "../../utils/senMail.js";
import mongoose from "mongoose";
import Crypto from "crypto";
import Role from "../../models/role.model.js";
import CoursePurchase from "../../models/Course_Purchase.js";
import Course from "../../models/Course.js";

export const getStudentsByTenant = async (req, res) => {
  try {
    console.log("**************************");
    console.log("getStudentsByTenant called", req.user);

    const { tenant_id } = req.user;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }


    const users = await Login.findOne({ _id: req.user.id }).populate('user_id');

    const assignedCourses = await Course.find({
      instructors: { $in: [users.user_id._id] },
    });
    // console.log('assignedcur',assignedCourses);


    const courseIds = assignedCourses.map(course => course._id);
    if (courseIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No courses assigned to instructor",
        data: [],
        count: 0,
      });
    }

    // console.log('Course IDs assigned to instructor:', courseIds);

    // Step 3: Find course purchases for these courses
    const coursePurchases = await CoursePurchase.find({
      course_id: { $in: courseIds },
    }).populate({
      path: 'user_id',
      select: 'fname lname email phone_number dob age tenant_id'
    });

    console.log('Course purchases:', coursePurchases);

    // Get unique students from course purchases
    const uniqueStudents = [];
    const seenStudentIds = new Set();

    // coursePurchases.forEach(purchase => {
    //   if (purchase.user_id && !seenStudentIds.has(purchase.user_id._id.toString())) {
    //     seenStudentIds.add(purchase.user_id._id.toString());
    //     // console.log(purchase);

    //     uniqueStudents.push({
    //       user_id: purchase.user_id._id,
    //       fname: purchase.user_id.fname,
    //       lname: purchase.user_id.lname,
    //       email: purchase.user_id.email,
    //       phone_number: purchase.user_id.phone_number,
    //       dob: purchase.user_id.dob,
    //       age: purchase.user_id.age,
    //       tenant_id: purchase.user_id.tenant_id,
    //       purchase_date: purchase.createdAt,
    //       course_id: purchase.course_id,
    //       is_active: purchase.user_id.is_active
    //     });
    //   }
    // });

    // console.log('Unique students:', uniqueStudents);

    for (const purchase of coursePurchases) {
      const studentId = purchase.user_id?._id?.toString();
      if (studentId && !seenStudentIds.has(studentId)) {
        seenStudentIds.add(studentId);

        // 🔍 Fetch login record to get status
        const loginData = await Login.findOne({ user_id: studentId });

        uniqueStudents.push({
          user_id: purchase.user_id._id,
          fname: purchase.user_id.fname,
          lname: purchase.user_id.lname,
          email: purchase.user_id.email,
          phone_number: purchase.user_id.phone_number,
          dob: purchase.user_id.dob,
          age: purchase.user_id.age,
          tenant_id: purchase.user_id.tenant_id,
          purchase_date: purchase.createdAt,
          course_id: purchase.course_id,
          is_active: loginData?.is_active || false  // fallback if null
        });
      }
    }


    return res.status(200).json({
      success: true,
      message: "Students fetched successfully",
      data: uniqueStudents,
      count: uniqueStudents.length,
    });

  } catch (error) {
    console.error("Error fetching students by tenant:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch students",
      error: error.message,
    });
  }
};

export const createStudent = async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { fname, lname, email, phone_number, dob, age } = req.body;
    console.log('req.user', req.user);


    // Validate required fields
    if (!fname || !lname || !email || !phone_number || !dob || !age) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided"
      });
    }

    // Check if email already exists in User or Login
    const existingUser = await User.findOne({ email });
    const existingLogin = await Login.findOne({ email, tenant_id });
    if (existingUser || existingLogin) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    // Find student role dynamically
    const roleFind = await Role.findOne({ name: "student" });
    if (!roleFind) {
      return res.status(400).json({
        success: false,
        message: "Student role not found"
      });
    }
    const role_id = roleFind._id;

    // Generate password setup token
    const passwordSetupToken = Crypto.randomBytes(32).toString("hex");
    const tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

    // Generate Unique User Code
    const roleDetails = await Role.findById(role_id);
    let userPrefix = "";

    if (roleDetails) {
      if (roleDetails.name.toLowerCase() === "student") {
        userPrefix = process.env.STUDENT_CODE_PREFIX || "STU";
      } else if (roleDetails.name.toLowerCase() === "instructor") {
        userPrefix = process.env.INSTRUCTOR_CODE_PREFIX || "INS";
      }
    }

    let user_code = "";
    if (userPrefix) {
      // Find the last user with this prefix to determine the next number
      const lastUser = await User.findOne({
        user_code: { $regex: new RegExp(`^${userPrefix}`) }
      }).sort({ createdAt: -1 });

      let nextNumber = 1;
      if (lastUser && lastUser.user_code) {
        const currentNumberStr = lastUser.user_code.replace(userPrefix, "");
        const currentNumber = parseInt(currentNumberStr, 10);
        if (!isNaN(currentNumber)) {
          nextNumber = currentNumber + 1;
        }
      }

      const paddedNumber = String(nextNumber).padStart(3, "0");
      user_code = `${userPrefix}${paddedNumber}`;
    }

    // 1. Create User
    const newUser = await User.create(
      {
        fname,
        lname,
        email,
        phone_number,
        dob,
        age,
        tenant_id,
        user_code,
      }
    );

    // 2. Create Login
    await Login.create(
      {
        user_id: newUser._id,
        tenant_id,
        email,
        role_id,
        passwordSetupToken,
        tokenExpiry,
        is_active: false,
      }
    );

    // Prepare email
    const setupLink = `${process.env.CORS_ORIGIN}/common/generate-password?token=${passwordSetupToken}`;

    // Try to send email
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Welcome to LMS SaaS</h2>
          <p>Your student account has been created successfully.</p>
          <p>Please click the link below to set your password and activate your account:</p>
          <a href="${setupLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Set Password</a>
          <p style="margin-top: 20px;">If the link doesn't work, copy and paste this URL into your browser:</p>
          <p>${setupLink}</p>
        </div>
      `;

      await sendMail({
        to: email,
        subject: "Welcome to LMS SaaS - Account Activation",
        text: `Welcome! Click this link to set your password: ${setupLink}`,
        html: emailHtml
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
      // We don't abort here because user and login were already created in separate steps.
      // In a non-transactional environment, we might want to inform the user that email failed but account was created.
    }

    return res.status(201).json({
      success: true,
      message: "Student created successfully. Email sent.",
    });
  } catch (error) {
    console.error("Error creating student:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create student",
      error: error.message
    });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    console.log("deleteStudent called");

    const { tenant_id } = req.user;
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required"
      });
    }

    // Find and delete student, ensuring it belongs to the current tenant
    const student = await User.findOneAndDelete({
      _id: studentId,
      tenant_id: tenant_id,
      role: "student"
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found or you don't have permission to delete"
      });
    }

    console.log(`Student deleted successfully: ${studentId}`);

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting student:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete student",
      error: error.message
    });
  }
};
