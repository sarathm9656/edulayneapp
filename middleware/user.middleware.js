import jwt, { decode } from "jsonwebtoken";
import Role from "../models/role.model.js";
import sessionSchema from "../models/UserSession.js";
export const userMiddleware = async (req, res, next) => {
try {
    console.log("auth middleware");
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  console.log('==========================================================================');
  
  console.log(req.cookies.token);
  
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  console.log(token);
  const decoded =await jwt.verify(token, process.env.JWT_SECRET);
  console.log(decode, "decoded data of the user");
  const correctRoleId = await Role.findById(decoded.role_id);
  console.log(correctRoleId);
  
  if (!correctRoleId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
   const session = await sessionSchema.findOne({ userId: decoded.id, token });
    if (!session) {
      return res.status(401).json({ message: 'Session expired or logged in elsewhere' });
    } 

  req.user = decoded;
  console.log("user middle end");
  
  next();
} catch (error) {
  console.log("middle ware error");
  
  console.log(error);
}
};
