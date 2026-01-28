import jwt from "jsonwebtoken";
import SuperAdmin from "../models/superAdmin.model.js";

export const authenticateSuperAdmin = async (req, res, next) => {
  try {
    // Get token from cookie 
    console.log('Super Admin Auth Middleware - Request cookies:', req.cookies);
    const token = req.cookies.token;

    if (!token) {
      console.log('Super Admin Auth Middleware - No token found');
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Super Admin Auth Middleware - Decoded token:', decoded);

    // Verify this is a super admin token
    if (decoded.role !== "super_admin") {
      console.log('Super Admin Auth Middleware - Invalid role:', decoded.role);
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required.",
      });
    }

    // Get super admin
    const superAdmin = await SuperAdmin.findById(decoded.id).populate(
      "role_id"
    );

    if (!superAdmin) {
      console.log('Super Admin Auth Middleware - Super admin not found');
      return res.status(401).json({
        success: false,
        message: "Super admin not found",
      });
    }

    console.log('Super Admin Auth Middleware - Authentication successful');
    // Attach super admin to request object
    req.superAdmin = superAdmin;
    next();
  } catch (error) {
    console.error('Super Admin Auth Middleware - Error:', error);
    return res.status(401).json({
      success: false,
      message: "Invalid token or authentication failed",
      error: error.message,
    });
  }
};
