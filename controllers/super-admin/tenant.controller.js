import Tenant from "../../models/tenant.model.js";
import Role from "../../models/role.model.js";
import User from "../../models/user.model.js";
import Login from "../../models/login.model.js";
import Crypto from "crypto";
import sendMail from "../../utils/senMail.js";
import mongoose from "mongoose";
import Subcategory from "../../models/Subcategory.js";
import Course from "../../models/Course.js";
import Module from "../../models/Module.js";
import Lesson from "../../models/Lesson.model.js";

// Create new tenant

export const getCurrentTenant = async (req, res) => {
  try {
    const { id } = req.user;
    const tenant = await Tenant.findById(id);
    res.status(200).json(tenant);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching tenant",
      error: error.message,
    });
  }
};

// Create a new tenant

export const createTenant = async (req, res) => {
  console.log("Working...");

  try {
    const { fname, lname, email, phone_number, subdomain, name } = req.body;
    console.log("Payload:", req.body);

    // Validation
    if (!fname || !lname || !email || !phone_number || !subdomain || !name) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check existing user
    const existingUser = await Login.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Check existing tenant
    const existingTenant = await Tenant.findOne({ subdomain });
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: "Tenant with this subdomain already exists",
      });
    }

    const role = await Role.findOne({ name: 'tenant' });
    if (!role) {
      throw new Error('Role "tenant" not found');
    }

    // Generate token
    const passwordSetupToken = Crypto.randomBytes(32).toString("hex");
    const tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

    console.log("Generated password setup token:", passwordSetupToken);
    console.log("Token expiry:", new Date(tokenExpiry).toISOString());

    // Create tenant
    const tenant = await Tenant.create(
      {
        name: name,
        subdomain,
        is_active: true,
      }
    );

    // Create user
    const newUser = await User.create(
      {
        fname,
        lname,
        email,
        phone_number,
      }
    );

    // Create login
    await Login.create(
      {
        email,
        user_id: newUser._id,
        tenant_id: tenant._id,
        role_id: role._id,
        passwordSetupToken,
        tokenExpiry,
        is_active: true,
      }
    );

    const setupLink = `${process.env.CORS_ORIGIN}/common/generate-password?token=${passwordSetupToken}`;

    console.log("Password setup link:", setupLink);

    // Send response
    res.status(201).json({
      success: true,
      message: "Tenant created successfully. Email is being sent.",
      data: tenant,
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to LMS SaaS</h2>
        <p>Your tenant account has been created successfully.</p>
        <p>Please click the link below to set your password and activate your workspace:</p>
        <a href="${setupLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Set Password</a>
        <p style="margin-top: 20px;">If the link doesn't work, copy and paste this URL into your browser:</p>
        <p>${setupLink}</p>
      </div>
    `;

    // Send email after response (non-blocking)
    console.log("Sending email to:", email);
    sendMail({
      to: email,
      subject: "Welcome to LMS SaaS - Account Activation",
      text: `Click this link to set your password: ${setupLink}`,
      html: emailHtml
    }).then(() => {
      console.log("Email sent successfully to:", email);
    }).catch((emailError) => {
      console.error("Email sending failed:", emailError.message);
    });

  } catch (error) {
    console.error("Tenant creation error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating tenant",
      error: error.message,
    });
  }
};
// Get all tenants
export const getAllTenants = async (req, res) => {

  console.log("getAllTenants");
  try {

    const tenants = await Tenant.find({})
    console.log(tenants, "tenants");

    // Fetch tenant role
    const tenantRole = await Role.findOne({ name: 'tenant' });
    if (!tenantRole) {
      return res.status(404).json({
        success: false,
        message: "Tenant role not found",
      });
    }

    const tenantLogins = await Login.find({ role_id: tenantRole._id })
      .populate('tenant_id')
      .populate('user_id')
      .populate('role_id');

    if (!tenantLogins || tenantLogins.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        tenants: [],
      });
    }

    // For now, we are not fetching per-tenant meeting credentials as we use global Dyte config
    const detailedTenants = tenants.map(tenant => {
      return {
        tenant,
        meetingCredential: null,
      };
    });

    res.status(200).json({
      success: true,
      count: detailedTenants.length,
      tenants: detailedTenants,
    });
  } catch (error) {
    console.error("Get tenants error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Simple endpoint for getting tenant list for dropdowns
export const getTenantList = async (req, res) => {
  try {
    const tenants = await Tenant.find({ is_active: true })
      .select('_id name')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: tenants,
    });
  } catch (error) {
    console.error("Get tenant list error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// // Get single tenant
export const getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    res.status(200).json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error("Get tenant error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateTenant = async (req, res) => {
  console.log("updateTenant called with:", req.body);
  try {
    const { id } = req.params;
    const {
      fname,
      lname,
      name,
      subdomain,
      is_active,
      email,
      phone_number,
    } = req.body;

    console.log("Updating tenant with ID:", id);
    const tenant = await Tenant.findByIdAndUpdate(
      id,
      { name, subdomain, is_active },
      { new: true }
    );
    if (!tenant) {
      console.log("Tenant not found for ID:", id);
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }
    console.log("Tenant updated successfully:", tenant.name);

    console.log("Updating login for tenant ID:", id);
    const login = await Login.findOneAndUpdate(
      { tenant_id: id },
      { email },
      { new: true }
    );
    if (!login) {
      console.log("Login not found for tenant ID:", id);
      return res.status(404).json({
        success: false,
        message: "Login not found",
      });
    }
    console.log("Login updated successfully for user ID:", login.user_id);

    // Update user first name, last name, and phone number
    if (fname || lname || phone_number) {
      console.log("Updating user with ID:", login.user_id, "fname:", fname, "lname:", lname, "phone_number:", phone_number);
      // Use the login record we already have
      const user = await User.findByIdAndUpdate(
        login.user_id,
        { fname, lname, phone_number },
        { new: true }
      );
      if (!user) {
        console.log("User not found for ID:", login.user_id);
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      console.log("User updated successfully:", user.fname, user.lname);
    }



    console.log("All updates completed successfully");
    res.status(200).json({
      success: true,
      message: "Tenant updated successfully",
    });
  } catch (error) {
    console.error("Update tenant error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteTenant = async (req, res) => {
  console.log("deleteTenant");
  const { tenantId } = req.params;
  console.log("id", tenantId);
  try {
    const courses = await Course.find({ tenant_id: tenantId });
    for (const course of courses) {
      const modules = await Module.find({ course_id: course._id });
      for (const module of modules) {
        await Lesson.deleteMany({ module_id: module._id });
      }
      await Module.deleteMany({ course_id: course._id });
      await Course.findByIdAndDelete(course._id);
    }
    await Login.deleteMany({ tenant_id: tenantId });
    await Tenant.findByIdAndDelete(tenantId);
    res.status(200).json({
      success: true,
      message: "Tenant deleted successfully",
    });
  } catch (error) {
    console.error("Delete tenant error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const tenant = await Tenant.findByIdAndUpdate(
      id,
      { is_active: status },
      { new: true }
    );
    if (!tenant) {
      return res.status(404).json({
        message: "Tenant not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Status Updated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
