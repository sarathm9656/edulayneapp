import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import SuperAdmin from "../../models/superAdmin.model.js";
import Role from "../../models/role.model.js";
import { ROLE_IDS } from "../../constants/roles.js";

// Login Super Admin
export const loginSuperAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find super admin by email and populate role
    const superAdmin = await SuperAdmin.findOne({ email: email.toLowerCase().trim() }).populate({
      path: "role_id",
      select: "name description",
    });

    console.log("Login Attempt:", email.toLowerCase().trim());

    // Check if super admin exists
    if (!superAdmin) {
      console.log("Super Admin not found in database");
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if super admin is active
    if (!superAdmin.is_active) {
      console.log("Super Admin account is deactivated");
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, superAdmin.password);
    if (!isPasswordValid) {
      console.log("Password mismatch for Super Admin");
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: superAdmin._id,
        email: superAdmin.email,
        role_id: superAdmin.role_id,
        role: superAdmin.role_id.name,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    // Set cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    };

    // Set cookie
    res.cookie("token", token, cookieOptions);

    // Send response
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role_id ? superAdmin.role_id.name : "super_admin",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Logout Super Admin
export const logoutSuperAdmin = (req, res) => {
  console.log("logoutSuperAdmin", req.user);
  try {
    // Clear the token cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get Current Super Admin
export const getCurrentSuperAdmin = async (req, res) => {
  try {
    const superAdmin = await SuperAdmin.findById(req.user.id)
      .select("-password")
      .populate({
        path: "role_id",
        select: "name description",
      });

    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: "Super admin not found",
      });
    }

    res.status(200).json({
      success: true,
      data: superAdmin,
    });
  } catch (error) {
    console.error("Get current super admin error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update Super Admin Profile
export const updateSuperAdminProfile = async (req, res) => {
  try {
    const { name, email, phone_number } = req.body;
    const superAdminId = req.user.id;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    // Check if email is already taken by another super admin
    const existingSuperAdmin = await SuperAdmin.findOne({
      email: email,
      _id: { $ne: superAdminId }
    });

    if (existingSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: "Email is already taken by another super admin",
      });
    }

    // Update the super admin
    const updatedSuperAdmin = await SuperAdmin.findByIdAndUpdate(
      superAdminId,
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone_number: phone_number ? phone_number.trim() : undefined,
      },
      { new: true, runValidators: true }
    ).select("-password").populate({
      path: "role_id",
      select: "name description",
    });

    if (!updatedSuperAdmin) {
      return res.status(404).json({
        success: false,
        message: "Super admin not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedSuperAdmin,
    });
  } catch (error) {
    console.error("Update super admin profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};