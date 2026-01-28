import crypto from "crypto";
import Login from "../../models/login.model.js";
import User from "../../models/user.model.js";
import Tenant from "../../models/tenant.model.js";
import sendMail from "../../utils/senMail.js";

// Tenant Users Forgot Password
export const tenantForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find user by email and populate related data
    const loginUser = await Login.findOne({ email })
      .populate("user_id", "fname lname")
      .populate("tenant_id", "name is_active")
      .populate("role_id", "name");

    if (!loginUser) {
      return res.status(404).json({
        success: false,
        message: "User with this email does not exist",
      });
    }

    // Check if user is active
    if (!loginUser.is_active) {
      return res.status(403).json({
        success: false,
        message: "User account is deactivated",
      });
    }

    // Check if tenant is active
    if (loginUser.tenant_id && !loginUser.tenant_id.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your organization account is deactivated. Please contact your administrator.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token to database
    loginUser.password_reset_token = resetToken;
    loginUser.password_reset_expires = resetTokenExpiry;
    await loginUser.save();

    // Create reset URL
    const resetUrl = `${process.env.CORS_ORIGIN}/reset-password?token=${resetToken}`;

    // Get user details
    const userName = loginUser.user_id 
      ? `${loginUser.user_id.fname} ${loginUser.user_id.lname}` 
      : "User";
    const tenantName = loginUser.tenant_id?.name || "Organization";
    const userRole = loginUser.role_id?.name || "User";

    // Email content
    const emailSubject = "Password Reset Request";
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${userName},</p>
        <p>You have requested to reset your password for your ${tenantName} account (${userRole} role).</p>
        <p>Click the link below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p><strong>Important:</strong></p>
        <ul>
          <li>This link will expire in 1 hour</li>
          <li>If you didn't request this reset, please ignore this email</li>
          <li>For security reasons, this link can only be used once</li>
          <li>After resetting, you'll need to login again with your new password</li>
        </ul>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          <strong>Account Details:</strong><br>
          Organization: ${tenantName}<br>
          Role: ${userRole}<br>
          Email: ${email}
        </p>
        <p style="color: #666; font-size: 12px;">
          This is an automated message from your organization's system. Please do not reply to this email.
        </p>
      </div>
    `;

    // Send email
    try {
      await sendMail({
        to: loginUser.email,
        subject: emailSubject,
        html: emailContent,
      });

      console.log(`✅ Tenant user password reset email sent to: ${loginUser.email} (${tenantName})`);

      res.status(200).json({
        success: true,
        message: "Password reset email sent successfully",
      });
    } catch (emailError) {
      console.error("❌ Error sending tenant user password reset email:", emailError);
      
      // Clear the reset token if email fails
      loginUser.password_reset_token = undefined;
      loginUser.password_reset_expires = undefined;
      await loginUser.save();

      res.status(500).json({
        success: false,
        message: "Failed to send password reset email. Please try again later.",
      });
    }
  } catch (error) {
    console.error("❌ Tenant forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

// Tenant Users Reset Password
export const tenantResetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Token, new password, and confirm password are required",
      });
    }

    // Validate password match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Find user by reset token
    const loginUser = await Login.findOne({
      password_reset_token: token,
      password_reset_expires: { $gt: new Date() },
    }).populate("user_id", "fname lname")
      .populate("tenant_id", "name is_active");

    if (!loginUser) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Check if user is still active
    if (!loginUser.is_active) {
      return res.status(403).json({
        success: false,
        message: "User account is deactivated",
      });
    }

    // Check if tenant is still active
    if (loginUser.tenant_id && !loginUser.tenant_id.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your organization account is deactivated. Please contact your administrator.",
      });
    }

    // Update password
    loginUser.password = newPassword;
    loginUser.password_reset_token = undefined;
    loginUser.password_reset_expires = undefined;
    loginUser.password_changed_at = new Date();
    await loginUser.save();

    const userName = loginUser.user_id 
      ? `${loginUser.user_id.fname} ${loginUser.user_id.lname}` 
      : "User";
    const tenantName = loginUser.tenant_id?.name || "Organization";

    console.log(`✅ Tenant user password reset successful for: ${loginUser.email} (${tenantName})`);

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("❌ Tenant reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};
