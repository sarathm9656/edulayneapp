import bcrypt from "bcrypt";
import Login from "../models/login.model.js";
import Tenant from "../models/tenant.model.js";
import sendMail from "../utils/senMail.js";
import Crypto from "crypto";

export const generatePassword = async (req, res) => {
  console.log("fn called");
  try {
    const { token, password } = req.body;
    console.log(password, "password in the generate password page");

    // Validate required fields
    if (!token || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required." });
    }

    const loginEntry = await Login.findOne({
      passwordSetupToken: token,
    });

    // Validate token existence
    if (!loginEntry) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token." });
    }

    // Validate token expiration
    if (loginEntry.tokenExpiry < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Token has expired." });
    }

    // Hash the new password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Update login credentials and clear token
    loginEntry.password = password;
    loginEntry.token = null;
    loginEntry.tokenExpiry = null;
    await loginEntry.save();

    // Activate tenant
    await Tenant.findByIdAndUpdate(loginEntry.tenant_id, { is_active: true });
    await Login.findByIdAndUpdate(loginEntry._id, { is_active: true });

    return res.status(200).json({
      success: true,
      message: "Password setup successful. Your account is now active.",
    });
  } catch (error) {
    console.error("Password setup error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const resendMail = async (req, res) => {
  try {
    const { token } = req.body;
    console.log("Resend mail request received for token:", token);

    const loginEntry = await Login.findOne({
      passwordSetupToken: token,
    }).populate('user_id');

    if (!loginEntry) {
      console.log("Login entry not found for token:", token);
      return res
        .status(400)
        .json({ success: false, message: "Invalid token." });
    }

    // Generate new token
    const passwordSetupToken = Crypto.randomBytes(32).toString("hex");
    const tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

    console.log("Generated new password setup token:", passwordSetupToken);
    console.log("Token expiry:", new Date(tokenExpiry).toISOString());

    // Update login entry with new token
    loginEntry.passwordSetupToken = passwordSetupToken;
    loginEntry.tokenExpiry = tokenExpiry;
    await loginEntry.save();

    // Create setup link
    const setupLink = `${process.env.CORS_ORIGIN}/common/generate-password?token=${passwordSetupToken}`;
    console.log("Password setup link:", setupLink);

    // Send fast response
    res.status(200).json({
      success: true,
      message: "Email resent successfully",
    });

    // Send email after response (non-blocking)
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to LMS SaaS - Password Setup</h2>
        <p>You requested to resend your password setup link.</p>
        <p>Please click the link below to set your password:</p>
        <a href="${setupLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Set Password</a>
        <p style="margin-top: 20px;">If the link doesn't work, copy and paste this URL into your browser:</p>
        <p>${setupLink}</p>
      </div>
    `;

    console.log("Sending email to:", loginEntry.email);
    sendMail({
      to: loginEntry.email,
      subject: "Welcome to LMS SaaS - Password Setup",
      text: `Click this link to set your password: ${setupLink}`,
      html: emailHtml
    }).then(() => {
      console.log("Email sent successfully to:", loginEntry.email);
    }).catch((emailError) => {
      console.error("Email sending failed:", emailError.message);
    });

  } catch (error) {
    console.error("Resend mail error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
