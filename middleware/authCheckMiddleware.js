import jwt from "jsonwebtoken";
import Tenant from "../models/tenant.model.js";
import Login from "../models/login.model.js";

export const authCheckMiddleware = async (req, res, next) => {
  try {
    const { token } = req.cookies;
    console.log(token, "token");
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
        errorCode: "TOKEN_MISSING",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log('decoded=======', decoded);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      tenant_id: decoded.tenant_id,
    };

    console.log(decoded, "decoded");

    // console.log('decoded.role=======', decoded);

    if (decoded.role === "superadmin" || decoded.role === "SUPER_ADMIN" || decoded.role === "super_admin") {
      console.log('Super admin detected, proceeding...');
      return next();
    }

    // --- Check if tenant is active ---
    if (decoded.tenant_id) {
      const tenant = await Tenant.findById(decoded.tenant_id);
      // console.log('inactived');

      if (!tenant || !tenant.is_active) {
        return res.status(403).json({
          success: false,
          message: "Tenant is inactive or does not exist",
          errorCode: "TENANT_INACTIVE",
        });
      }
    }
    // --- End tenant check ---
    // console.log('decoded.status=======',decoded.status);

    // --- Check if user status is active ---
    const user = await Login.findById(decoded.id);
    // console.log('user=======', user);

    if (!user || user.is_active === false || String(user.is_active) === "false") {
      return res.status(403).json({
        success: false,
        message: "User account is inactive or does not exist",
        errorCode: "USER_INACTIVE",
      });
    }
    // --- End user status check ---

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token invalid or expired",
      errorCode: "TOKEN_INVALID",
    });
  }
};
