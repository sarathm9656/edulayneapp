import jwt, { decode } from "jsonwebtoken";
import Role from "../models/role.model.js";

export const authMiddleware = async (req, res, next) => {
  try {
    console.log("auth middleware");
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    console.log(token);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded, "decoded");
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
