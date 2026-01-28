import jwt from "jsonwebtoken";
import SuperAdmin from "../models/superAdmin.model.js";
import { ROLE_IDS } from "../constants/roles.js";

export const isSuperAdmin = async (req, res, next) => {
  try {
    console.log("isSuperAdmin middleware");
    // Get token from cookies or Authorization header
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    console.log(token, "token");
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is super admin
    if (decoded.role !== ROLE_IDS.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin access required.",
      });
    }

    // Find super admin and check if active
    const superAdmin = await SuperAdmin.findById(decoded.id);
    if (!superAdmin || !superAdmin.is_active) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated or not found.",
      });
    }

    // Add super admin info to request
    req.user = {
      id: superAdmin._id,
      email: superAdmin.email,
      role: ROLE_IDS.SUPER_ADMIN,
      isSuperAdmin: true,
    };
    console.log(req.user, "req.user");
    next();
  } catch (error) {
    console.error("Super admin check error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid token or unauthorized access.",
    });
  }
};
