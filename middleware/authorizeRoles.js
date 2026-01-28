export const authorizeRoles = (...roles) => {
  // console.log("TTTTTTTTTTTTTTTTTTTTTTTTTT");
  
  return (req, res, next) => {
    console.log("Debug - authorizeRoles:", {
      userRole: req.user.role,
      userRoleLower: req.user.role?.toLowerCase().trim(),
      allowedRoles: roles,
      userObject: req.user
    });
    
    if (!roles.includes(req.user.role.toLowerCase().trim())) {
      return res
        .status(403)
        .json({ message: "You are not authorized to access this resource" });
    }
    next();
  };
};
