import jwt from "jsonwebtoken";
import Role from "../models/role.model.js";
export const instructorMiddleware = async (req, res, next) => {
  try {
    // console.log("tenantMiddleware");
    // console.log("tenantMiddleware", req.cookies);
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // console.log("================================================");
    // console.log(decoded);
    // console.log("================================================");

    const correctRoleId = await Role.findById(decoded.role_id);
    if (!correctRoleId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
