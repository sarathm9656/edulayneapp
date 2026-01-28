import User from "../../models/user.model.js";
import Login from "../../models/login.model.js";
import Course from "../../models/Course.js";
import InstructorPricing from "../../models/instructor_pricing.js";
import Role from "../../models/role.model.js";
import BatchStudent from "../../models/Batch_Students.js";
import Batch from "../../models/Batch_table.js";
import CoursePurchase from "../../models/Course_Purchase.js";
import mongoose from "mongoose";
import sendMail from "../../utils/senMail.js";
import bcrypt from "bcrypt";
import generateRandomPassword from "../../config/generatePassword.js";
import jwt from "jsonwebtoken";
// Create a new user with login credentials
export const createUser = async (req, res) => {
  console.log("createUser", req.body);
  console.log(req.user, "req.user");

  try {
    const {
      // User details
      fname,
      lname,
      // age,
      dob,
      phone_number,
      // Login details
      email,
      // password,
      role_id,
      price_per_hour,
      batch_id, // Added batch_id for student enrollment
      payment_type,
      payment_amount,
      assigned_courses,
      assigned_batches,
      gender,
      address,
      bio,
      profile_image
    } = req.body;
    // Calculate age from dob if provided
    console.log("((((((((((((((((((((((((((((((((((((((");
    console.log(req.body);

    console.log("((((((((((((((((((((((((((((((((((((((");


    let age = 0;
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }
    // Validate required fields
    if (!fname || !lname || !email || !role_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }
    // console.log();

    // Check if email already exists for the tenant
    const existingLogin = await Login.findOne({
      email,
      tenant_id: req.user.tenant_id,
    });
    console.log('=============================');
    console.log('=============================');
    console.log(existingLogin);

    console.log('=============================');
    console.log('=============================');

    if (existingLogin) {
      if (batch_id) {
        // If it's a student, check if they are already in this batch
        const role = await Role.findById(existingLogin.role_id);
        if (role && role.name.toLowerCase() === 'student') {
          const existingEnrollment = await BatchStudent.findOne({
            batch_id,
            student_id: existingLogin._id
          });

          if (existingEnrollment) {
            return res.status(400).json({
              success: false,
              message: "Student is already enrolled in this batch",
            });
          }

          // Not enrolled in this batch, let's enroll them
          const newBatchStudent = new BatchStudent({
            batch_id,
            student_id: existingLogin._id,
            status: "active"
          });
          await newBatchStudent.save();

          return res.status(200).json({
            success: true,
            message: "Existing student enrolled in batch successfully",
            data: existingLogin
          });
        }
      }

      return res.status(400).json({
        success: false,
        message: "Email already exists for this tenant",
      });
    }

    const user = new User({
      fname,
      lname,
      age,
      dob,
      phone_number,
      email,
      gender,
      address,
      bio,
      profile_image
    });

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

    if (userPrefix) {
      // Find the last user with this prefix to determine the next number
      // We regex search for the prefix at the start of user_code
      const lastUser = await User.findOne({
        user_code: { $regex: new RegExp(`^${userPrefix}`) }
      }).sort({ createdAt: -1 });

      let nextNumber = 1;
      if (lastUser && lastUser.user_code) {
        // Extract number from the end (assuming format PREFIX001)
        const currentNumberStr = lastUser.user_code.replace(userPrefix, "");
        const currentNumber = parseInt(currentNumberStr, 10);
        if (!isNaN(currentNumber)) {
          nextNumber = currentNumber + 1;
        }
      }

      // Pad with leading zeros (e.g., 001)
      const paddedNumber = String(nextNumber).padStart(3, "0");
      user.user_code = `${userPrefix}${paddedNumber}`;
    }

    // !password should be generated in a more secure random way

    const password = generateRandomPassword(12);
    console.log(password);

    await user.save();
    console.log(user, "user created");
    // Create login credentials
    const login = new Login({
      user_id: user._id,
      tenant_id: req.user.tenant_id,
      email,
      password, // Will be hashed by pre-save middleware
      role_id,
    });

    await login.save();

    // Create instructor pricing record if role is instructor
    const roleForPricing = await Role.findById(role_id);
    if (roleForPricing && roleForPricing.name.toLowerCase() === 'instructor') {
      const pricingData = {
        instructor_id: login._id,
        payment_type: payment_type || "salary",
        payment_amount: payment_amount ? parseFloat(payment_amount) : 0,
        price_per_hour: price_per_hour ? parseFloat(price_per_hour) : 0,
      };

      if (assigned_courses && Array.isArray(assigned_courses)) {
        pricingData.assigned_courses = assigned_courses;
      }

      const instructorPricing = new InstructorPricing(pricingData);
      await instructorPricing.save();

      // Handle batch assignments for instructor
      if (assigned_batches && Array.isArray(assigned_batches)) {
        for (const batchId of assigned_batches) {
          // Check for time conflict before adding
          const targetBatch = await Batch.findById(batchId);
          if (targetBatch) {
            // Check if instructor already has a batch at this time
            const existingBatches = await Batch.find({
              tenant_id: req.user.tenant_id,
              $or: [
                { instructor_id: login._id },
                { instructor_ids: login._id }
              ],
              _id: { $ne: batchId }
            });

            const hasConflict = existingBatches.some(b => {
              // Simple time conflict check: if same recurring day and overlapping batch_time
              // This is a basic check. Can be refined later.
              const daysOverlap = b.recurring_days.some(d => targetBatch.recurring_days.includes(d));
              if (daysOverlap && b.batch_time === targetBatch.batch_time) {
                return true;
              }
              return false;
            });

            if (hasConflict) {
              console.warn(`Time conflict detected for instructor ${login.email} with batch ${batchId}`);
              // We could return an error here, but for now let's just push it or handle as requested
            }

            // Assign instructor to batch
            await Batch.findByIdAndUpdate(batchId, {
              $addToSet: { instructor_ids: login._id }
            });
          }
        }
      }
    }

    // Handle student enrollment in batch if batch_id is provided
    if (batch_id && role_id) {
      const roleData = await Role.findById(role_id);
      if (roleData && roleData.name.toLowerCase() === 'student') {
        const batch = await Batch.findOne({ _id: batch_id, tenant_id: req.user.tenant_id });
        if (batch) {
          const existingEnrollment = await BatchStudent.findOne({
            batch_id,
            student_id: login._id
          });

          if (!existingEnrollment) {
            const newBatchStudent = new BatchStudent({
              batch_id,
              student_id: login._id,
              status: "active"
            });
            await newBatchStudent.save();
            console.log("Student enrolled in batch:", batch_id);
          }
        }
      }
    }

    // Handle student enrollment in course if course_id is provided
    if (req.body.course_id && role_id) {
      const roleData = await Role.findById(role_id);
      if (roleData && roleData.name.toLowerCase() === 'student') {
        const course = await Course.findOne({ _id: req.body.course_id, tenant_id: req.user.tenant_id });
        if (course) {
          const existingPurchase = await CoursePurchase.findOne({
            course_id: req.body.course_id,
            user_id: user._id
          });

          if (!existingPurchase) {
            const newPurchase = new CoursePurchase({
              user_id: user._id,
              course_id: req.body.course_id,
              tenant_id: req.user.tenant_id,
              purchased_at: new Date(),
              valid_till: course.validity ? new Date(Date.now() + course.validity * 24 * 60 * 60 * 1000) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Default 1 year if not specified
            });
            await newPurchase.save();
            console.log("Student enrolled in course:", req.body.course_id);
          }
        }
      }
    }

    // Return user data without sensitive information
    const userResponse = {
      _id: user._id,
      fname: user.fname,
      lname: user.lname,
      gender: user.gender,
      user_code: user.user_code,
      email: login.email,
      role_id: login.role_id,
      tenant_id: login.tenant_id,
      created_at: user.createdAt,
    };

    // Only include price_per_hour if the user is an instructor
    const roleForResponse = await Role.findById(role_id);
    if (roleForResponse && roleForResponse.name.toLowerCase() === 'instructor') {
      userResponse.price_per_hour = price_per_hour ? parseFloat(price_per_hour) : null;
    }

    // Send email after successful creation
    try {
      const token = jwt.sign({ email: login.email }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      // Use CORS_ORIGIN instead of undefined FRONTEND_URL
      const baseUrl = process.env.CORS_ORIGIN || "http://localhost:5173";
      const resetPasswordLink = `${baseUrl}/reset-password?token=${token}`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Welcome to our platform</h2>
          <p>Your account has been created successfully.</p>
          <div style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; margin: 10px 0;">
            <p style="margin: 0;">Your specific password is: <strong>${password}</strong></p>
          </div>
          <p>You can login with this password, or click the link below to set a new password:</p>
          <a href="${resetPasswordLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Set New Password</a>
          <p style="margin-top: 20px;">If the link doesn't work, copy and paste this URL into your browser:</p>
          <p>${resetPasswordLink}</p>
        </div>
      `;

      await sendMail({
        to: login.email,
        subject: "Welcome to our platform - Account Details",
        text: `Welcome! Your password is ${password}. You can reset your password here: ${resetPasswordLink}`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Don't fail the user creation if email fails
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userResponse,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message,
    });
  }
};

export const updateInstructor = async (req, res) => {
  const { id } = req.params;
  const { fname, lname, age, dob, phone_number, email, status } = req.body;

  const instructor = await User.findByIdAndUpdate(id, { fname, lname, age, dob, phone_number }, { new: true });
  res.status(200).json({ success: true, data: instructor });
};

// Get user details by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Get user with login details using aggregation
    const user = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "logins",
          localField: "_id",
          foreignField: "user_id",
          as: "login",
        },
      },
      { $unwind: "$login" },
      {
        $project: {
          _id: 1,
          fname: 1,
          lname: 1,
          age: 1,
          dob: 1,
          phone_number: 1,
          created_at: 1,
          email: "$login.email",
          role_id: "$login.role_id",
          tenant_id: "$login.tenant_id",
          is_active: "$login.is_active",
          gender: 1,
          address: 1,
          bio: 1,
          profile_image: 1,
          user_code: 1
        },
      },
    ]);

    if (!user.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user[0],
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user details",
      error: error.message,
    });
  }
};

// Update user details
export const updateUser = async (req, res) => {
  console.log('working');
  console.log(req.body);

  try {
    const { id } = req.params;
    const {
      fname,
      lname,
      // age,
      dob,
      phone_number,
      email,
      // password,
      role_id,
      status,
      price_per_hour,
      payment_type,
      payment_amount,
      assigned_courses,
      assigned_batches,
      gender,
      address,
      bio,
      profile_image
    } = req.body;
    // Calculate age from dob if provided
    let age = 0;
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }
    // console.log(is_active);

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Check if user exists and get their current role
    const userLogin = await Login.findOne({ user_id: id }).populate("role_id");
    if (!userLogin) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if email already exists (excluding current user)
    if (email && email !== userLogin.email) {
      const existingEmail = await Login.findOne({
        email: email,
        user_id: { $ne: id } // Exclude current user
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }
    // Prevent deactivation of super admin
    const superAdminRoleId = "682c0541089c54ce890db8b3";
    if (
      userLogin.role_id._id.toString() === superAdminRoleId &&
      status === "inactive" // Changed from is_active to status
    ) {
      return res.status(403).json({
        success: false,
        message: "Cannot deactivate super admin user",
      });
    }

    // Prevent role change of super admin
    if (
      userLogin.role_id._id.toString() === superAdminRoleId &&
      role_id &&
      role_id !== superAdminRoleId
    ) {
      return res.status(403).json({
        success: false,
        message: "Cannot change super admin role",
      });
    }

    // Update user details
    const user = await User.findByIdAndUpdate(
      id,
      {
        fname,
        lname,
        age,
        dob,
        phone_number,
        gender,
        address,
        bio,
        profile_image
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update login details if provided
    const loginUpdate = {};
    if (email) loginUpdate.email = email;
    // if (password) loginUpdate.password = password;
    if (role_id) loginUpdate.role_id = role_id;

    // Only update is_active if status is explicitly provided
    // This prevents accidentally deactivating users when just updating profile info
    if (status !== undefined) {
      // Handle boolean or string status
      const isActive =
        status === true ||
        String(status).toLowerCase() === "active" ||
        String(status).toLowerCase() === "true";
      loginUpdate.is_active = isActive;
    }

    console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
    console.log(loginUpdate);

    if (Object.keys(loginUpdate).length > 0) {
      const login = await Login.findOneAndUpdate({ user_id: id }, loginUpdate, {
        new: true,
      });
      console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
      console.log(login);


      if (!login) {
        throw new Error("Login details not found");
      }
    }

    // Handle instructor pricing update if role is instructor
    if (userLogin.role_id.name.toLowerCase() === 'instructor') {
      const pricingUpdate = {
        payment_type: payment_type || "salary",
        payment_amount: payment_amount ? parseFloat(payment_amount) : 0,
        price_per_hour: price_per_hour ? parseFloat(price_per_hour) : 0,
      };

      if (assigned_courses) {
        pricingUpdate.assigned_courses = assigned_courses;
      }

      const instructorPricing = await InstructorPricing.findOneAndUpdate(
        { instructor_id: userLogin._id },
        pricingUpdate,
        {
          new: true,
          upsert: true // Create if doesn't exist
        }
      );

      if (!instructorPricing) {
        throw new Error("Failed to update instructor pricing");
      }

      // Handle batch assignments for instructor update
      if (assigned_batches && Array.isArray(assigned_batches)) {
        // Option 1: Replace all instructor batches. 
        // First remove from all batches for this tenant
        await Batch.updateMany(
          { tenant_id: req.user.tenant_id, instructor_ids: userLogin._id },
          { $pull: { instructor_ids: userLogin._id } }
        );

        for (const batchId of assigned_batches) {
          await Batch.findByIdAndUpdate(batchId, {
            $addToSet: { instructor_ids: userLogin._id }
          });
        }
      }
    }

    // Get updated user with login details
    const updatedUser = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "logins",
          localField: "_id",
          foreignField: "user_id",
          as: "login",
        },
      },
      { $unwind: "$login" },
      {
        $lookup: {
          from: "instructorpricings",
          localField: "login._id",
          foreignField: "instructor_id",
          as: "pricing",
        },
      },
      {
        $project: {
          _id: 1,
          fname: 1,
          lname: 1,
          age: 1,
          dob: 1,
          phone_number: 1,
          created_at: 1,
          email: "$login.email",
          role_id: "$login.role_id",
          tenant_id: "$login.tenant_id",
          status: "$login.is_active",
          price_per_hour: { $arrayElemAt: ["$pricing.price_per_hour", 0] },
          payment_type: { $arrayElemAt: ["$pricing.payment_type", 0] },
          payment_amount: { $arrayElemAt: ["$pricing.payment_amount", 0] },
          assigned_courses: { $arrayElemAt: ["$pricing.assigned_courses", 0] },
          gender: 1,
          address: 1,
          bio: 1,
          profile_image: 1,
          user_code: 1
        },
      },
    ]);

    // Manually add assigned batches to the response
    if (updatedUser.length > 0) {
      const instructor_batches = await Batch.find({
        tenant_id: req.user.tenant_id,
        $or: [
          { instructor_id: updatedUser[0].login?._id || userLogin._id },
          { instructor_ids: updatedUser[0].login?._id || userLogin._id }
        ]
      }).select('_id batch_name course_id');
      updatedUser[0].assigned_batches = instructor_batches.map(b => b._id);
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser[0],
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

// --------------------------------------------------

// Delete user (complete deletion from both tables)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Check if user exists and get their role
    const userLogin = await Login.findOne({ user_id: id }).populate("role_id");
    if (!userLogin) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deletion of super admin
    const superAdminRoleId = "682c0541089c54ce890db8b3";
    if (userLogin.role_id._id.toString() === superAdminRoleId) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete super admin user",
      });
    }

    // Remove user from all courses where they are listed as instructor
    await Course.updateMany(
      { instructors: id },
      { $pull: { instructors: id } }
    );

    // Delete from login table first
    await Login.deleteOne({ user_id: id });

    // Then delete from user table
    await User.deleteOne({ _id: id });

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

// Get all users for a tenant
export const getUsersByTenant = async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { page = 1, limit = 10, search = "" } = req.query;

    // Validate tenant ID
    if (!mongoose.Types.ObjectId.isValid(tenant_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tenant ID",
      });
    }

    // Build search query
    const searchQuery = search
      ? {
        $or: [
          { fname: { $regex: search, $options: "i" } },
          { lname: { $regex: search, $options: "i" } },
          { "login.email": { $regex: search, $options: "i" } },
        ],
      }
      : {};

    // Get users with pagination
    const users = await User.aggregate([
      {
        $lookup: {
          from: "logins",
          localField: "_id",
          foreignField: "user_id",
          as: "login",
        },
      },
      { $unwind: "$login" },
      {
        $match: {
          "login.tenant_id": new mongoose.Types.ObjectId(tenant_id),
          ...searchQuery,
        },
      },
      {
        $project: {
          _id: 1,
          fname: 1,
          lname: 1,
          age: 1,
          dob: 1,
          phone_number: 1,
          created_at: 1,
          email: "$login.email",
          role_id: "$login.role_id",
          role_id: "$login.role_id",
          is_active: "$login.is_active",
          gender: 1,
          address: 1,
          bio: 1,
          profile_image: 1,
          user_code: 1
        },
      },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) },
    ]);

    // Get total count for pagination
    const total = await User.aggregate([
      {
        $lookup: {
          from: "logins",
          localField: "_id",
          foreignField: "user_id",
          as: "login",
        },
      },
      { $unwind: "$login" },
      {
        $match: {
          "login.tenant_id": new mongoose.Types.ObjectId(tenant_id),
          ...searchQuery,
        },
      },
      { $count: "total" },
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total: total[0]?.total || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((total[0]?.total || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// Get users by tenant and role
export const getUsersByTenantAndRole = async (req, res) => {
  try {
    const { tenant_id, role_id } = req.params;
    const { page = 1, limit = 10, search = "" } = req.query;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(tenant_id) ||
      !mongoose.Types.ObjectId.isValid(role_id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid tenant ID or role ID",
      });
    }

    // Build search query
    const searchQuery = search
      ? {
        $or: [
          { fname: { $regex: search, $options: "i" } },
          { lname: { $regex: search, $options: "i" } },
          { "login.email": { $regex: search, $options: "i" } },
        ],
      }
      : {};

    // Get users with pagination
    const users = await User.aggregate([
      {
        $lookup: {
          from: "logins",
          localField: "_id",
          foreignField: "user_id",
          as: "login",
        },
      },
      { $unwind: "$login" },
      {
        $match: {
          "login.tenant_id": new mongoose.Types.ObjectId(tenant_id),
          "login.role_id": new mongoose.Types.ObjectId(role_id),
          ...searchQuery,
        },
      },
      {
        $lookup: {
          from: "roles",
          localField: "login.role_id",
          foreignField: "_id",
          as: "role",
        },
      },
      { $unwind: "$role" },
      {
        $project: {
          _id: 1,
          fname: 1,
          lname: 1,
          age: 1,
          dob: 1,
          phone_number: 1,
          created_at: 1,
          email: "$login.email",
          role: {
            _id: "$role._id",
            name: "$role.name",
          },
          is_active: "$login.is_active",
        },
      },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) },
    ]);

    // Get total count for pagination
    const total = await User.aggregate([
      {
        $lookup: {
          from: "logins",
          localField: "_id",
          foreignField: "user_id",
          as: "login",
        },
      },
      { $unwind: "$login" },
      {
        $match: {
          "login.tenant_id": new mongoose.Types.ObjectId(tenant_id),
          "login.role_id": new mongoose.Types.ObjectId(role_id),
          ...searchQuery,
        },
      },
      { $count: "total" },
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total: total[0]?.total || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((total[0]?.total || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// Get all users with their details
export const getAllUsers = async (req, res) => {

  console.log(
    "getAllUsers==================================================*******************"
  );
  console.log(req.user, "req.user");

  try {
    // Add error handling for invalid search terms
    const { page = 1, limit = 10, search = "", role = "", tenant = "" } = req.query;

    // Validate search term
    if (search && typeof search !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Invalid search parameter",
      });
    }
    console.log("Query parameters:", { page, limit, search, role, tenant });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build search query
    let searchQuery = {};
    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      searchQuery = {
        $or: [
          { fname: { $regex: searchTerm, $options: "i" } },
          { lname: { $regex: searchTerm, $options: "i" } },
          { email: { $regex: searchTerm, $options: "i" } },
          // Also search for full name (first + last)
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ["$fname", " ", "$lname"] },
                regex: searchTerm,
                options: "i"
              }
            }
          },
        ],
      };
    }

    // Build role filter
    let roleFilter = {};
    if (role && role !== "all") {
      roleFilter = { "login.role_id": new mongoose.Types.ObjectId(role) };
    }

    // Build tenant filter
    let tenantFilter = {};
    if (tenant && tenant !== "") {
      tenantFilter = { "login.tenant_id": new mongoose.Types.ObjectId(tenant) };
    }

    // console.log("Filters:", { searchQuery, roleFilter, tenantFilter });
    // console.log("Search value:", search);

    // Build the match condition
    const matchCondition = {
      ...roleFilter,
      ...tenantFilter,
    };

    // Only add search query if it's not empty
    if (Object.keys(searchQuery).length > 0) {
      Object.assign(matchCondition, searchQuery);
    }

    // console.log("Final match condition:", matchCondition);
    // console.log("Search term:", search);
    // console.log("Search query object:", searchQuery);

    // Get users with pagination and filters
    const users = await User.aggregate([
      {
        $lookup: {
          from: "logins",
          localField: "_id",
          foreignField: "user_id",
          as: "login",
        },
      },
      { $unwind: "$login" },
      {
        $lookup: {
          from: "roles",
          localField: "login.role_id",
          foreignField: "_id",
          as: "role",
        },
      },
      {
        $lookup: {
          from: "tenants",
          localField: "login.tenant_id",
          foreignField: "_id",
          as: "tenant",
        },
      },
      {
        $addFields: {
          email: "$login.email",
          role_id: "$login.role_id",
          tenant_id: "$login.tenant_id",
          is_active: "$login.is_active",
        },
      },
      {
        $match: matchCondition,
      },

      {
        $project: {
          _id: 1,
          fname: 1,
          lname: 1,
          age: 1,
          dob: 1,
          phone_number: 1,
          created_at: 1,
          email: 1,
          role_id: 1,
          is_active: 1,
          role: { $arrayElemAt: ["$role", 0] },
          tenant: { $arrayElemAt: ["$tenant", 0] },
        },
      },
      { $skip: skip },
      { $limit: limitNum },
    ]);

    // console.log(`Found ${users.length} users with filters`);
    // console.log("First few users:", users.slice(0, 3).map(u => ({ fname: u.fname, lname: u.lname, email: u.email })));

    // Get total count for pagination
    const total = await User.aggregate([
      {
        $lookup: {
          from: "logins",
          localField: "_id",
          foreignField: "user_id",
          as: "login",
        },
      },
      { $unwind: "$login" },
      {
        $lookup: {
          from: "roles",
          localField: "login.role_id",
          foreignField: "_id",
          as: "role",
        },
      },
      {
        $lookup: {
          from: "tenants",
          localField: "login.tenant_id",
          foreignField: "_id",
          as: "tenant",
        },
      },
      {
        $addFields: {
          email: "$login.email",
          role_id: "$login.role_id",
          tenant_id: "$login.tenant_id",
          is_active: "$login.is_active",
        },
      },
      {
        $match: matchCondition,
      },
      { $count: "total" },
    ]);

    const totalUsers = total[0]?.total || 0;

    console.log(`Total users count: ${totalUsers}`);

    res.status(200).json({
      success: true,
      data: users,
      total: totalUsers,
      pagination: {
        total: totalUsers,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalUsers / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

export const getUsersByRole = async (req, res) => {
  try {
    const { role_id } = req.params;

    // Validate role ID
    if (!mongoose.Types.ObjectId.isValid(role_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role ID",
      });
    }

    // Get users with the specified role
    const users = await User.aggregate([
      {
        $lookup: {
          from: "logins",
          localField: "_id",
          foreignField: "user_id",
          as: "login",
        },
      },
      { $unwind: "$login" },
      {
        $match: {
          "login.role_id": new mongoose.Types.ObjectId(role_id),
        },
      },
      {
        $project: {
          _id: 1,
          fname: 1,
          lname: 1,
          email: "$login.email",
          is_active: "$login.is_active",
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

export const searchUsers = async (req, res) => {
  const { tenant_id } = req.user;
  console.log("------------------------------");
  try {
    const { searchValue } = req.params;
    const { role_id } = req.query; // Get role_id from query parameters

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

    console.log(role_id, "role_id");
    console.log(searchValue, "searchValue");
    const matchStage = {
      $match: {
        $or: [
          { fname: { $regex: searchValue, $options: "i" } },
          { lname: { $regex: searchValue, $options: "i" } },
          { email: { $regex: searchValue, $options: "i" } },
        ],
      },
    };

    // If role_id is provided, add it to the match stage
    if (role_id) {
      matchStage.$match.role_id = role_id;
    }

    const users = await Login.find({ role_id }).populate("user_id");
    const userIds = users.map((user) => user.user_id);
    const usersData = await User.find({ _id: { $in: userIds } });
    console.log(usersData, "usersData");
    // filter by searchValue
    let filteredUsers = [];
    if (searchValue !== "all") {
      filteredUsers = usersData.filter((user) => {
        return (
          user.fname.toLowerCase().includes(searchValue.toLowerCase()) ||
          user.lname.toLowerCase().includes(searchValue.toLowerCase()) ||
          user.email.toLowerCase().includes(searchValue.toLowerCase())
        );
      });
    } else {
      filteredUsers = usersData;
    }
    console.log(filteredUsers, "filteredUsers");
    res.status(200).json({
      success: true,
      data: filteredUsers,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({
      success: false,
      message: "Error searching users",
      error: error.message,
    });
  }
};

// toggle user status
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // validate user id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }
    // check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const login = await Login.findOne({ user_id: id });
    if (!login) {
      return res.status(404).json({
        success: false,
        message: "Login not found",
      });
    }
    login.is_active = !login.is_active;
    await login.save();
    res.status(200).json({
      success: true,
      message: "User status toggled successfully",
    });
  } catch (error) {
    console.error("Error toggling user status:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling user status",
      error: error.message,
    });
  }
};

export async function requestPasswordReset(req, res) {
  //   const password=`student@${Math.floor(Math.random() * 10000)}`
  // console.log(password);
  //  sendMail({ to: login.email, subject: "Welcome to our platform", text: `Your password is ${password}` });
  console.log("inside requestresetpassword", req.body);
  const { email, _id } = req.body;
  console.log(email);
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const login = await Login.findOne({ user_id: user._id });
    if (!login) {
      return res.status(404).json({ message: "Login not found" });
    }
    // const token = jwt.sign(
    //   {
    //     id: user._id,
    //     role: user.role_id.name,
    //     role_id: user.role_id._id,
    //     tenant_id: user.tenant_id,
    //   },
    //   process.env.JWT_SECRET,
    //   { expiresIn: "1d" }
    // );
    const key = `student@${Math.floor(Math.random() * 10000)}`;
    const password = await bcrypt.hash(key, 10);

    await Login.updateOne({ _id: login._id }, { $set: { password } });
    sendMail({
      to: login.email,
      subject: "Welcome to our platform",
      text: `Your password is ${key}`,
    });
    res.status(200).json({ message: "Password reset email sent successfully" });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    res.status(500).json({ message: "Error sending password reset email" });
  }
}

export const getUsersCount = async (req, res) => {
  const users = await User.find({});
  res.status(200).json({
    success: true,
    data: users.length,
  });
};

