import Login from "../../models/login.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import sessionSchema from "../../models/UserSession.js";
import Tenant from "../../models/tenant.model.js";

export const loginUser = async (req, res) => {
  console.log("loginUser");
  try {
    console.log(req.body);

    const { email, password } = req.body;
    // Populate role and user_id. Note: tenant_id is not populated (it's an ID on the model)
    const user = await Login.findOne({ email }).populate("role_id").populate("user_id");

    console.log("************************************************************");
    console.log(user ? `User found: ${user.email}` : "User not found");
    console.log("************************************************************");

    if (!user) {
      return res.status(401).json({ message: "Email not found" });
    }

    // --- INTEGRITY CHECKS ---
    // Handle cases where relational data is missing
    if (!user.role_id) {
      console.error(`Login Integrity Error: Role not found for user ${user.email} (ID: ${user._id})`);
      return res.status(500).json({ message: "System error: User role configuration missing" });
    }

    if (!user.user_id) {
      console.error(`Login Integrity Error: User profile not found for user ${user.email} (ID: ${user._id})`);
      // Attempt recovery or just fail
      return res.status(500).json({ message: "System error: User profile data missing" });
    }
    // ------------------------

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid Password" });
    }
    if (user.is_active === false || String(user.is_active) === "false") {
      return res.status(401).json({ message: "Account Deactivated" });
    }

    // --- New: Check if user's tenant is active ---
    if (user.tenant_id) {
      const tenant = await Tenant.findById(user.tenant_id);
      if (!tenant || !tenant.is_active) {
        return res.status(403).json({
          success: false,
          message: "Tenant is inactive or does not exist",
          errorCode: "TENANT_INACTIVE",
        });
      }
    }
    // --- End new code ---

    await sessionSchema.deleteMany({ userId: user._id });

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role_id.name,
        role_id: user.role_id._id,
        tenant_id: user.tenant_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    const deviceInfo = req.headers["user-agent"] || "unknown";
    await sessionSchema.create({
      userId: user._id,
      token,
      deviceInfo,
    });

    // Set cookie key based on role
    let cookieKey = "token";

    res.cookie(cookieKey, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.user_id.fname + " " + user.user_id.lname,
        email: user.email,
        role: user.role_id.name,
        role_id: user.role_id._id,
      },
      token // Send token in body as well
    });
  } catch (error) {
    console.error("Login Controller Error:", error);
    res.status(500).json({
      message: "Internal Server Error during login",
      error: error.message
    });
  }
};

export const getCurrentUser = async (req, res) => {
  console.log("get usersss");
  console.log("user", req.user);
  const { id } = req.user;
  const user = await Login.findById(id)
    .select("-password")
    .populate("user_id", "fname lname age dob email phone_number")
    .populate("role_id", "name description")
    .populate("tenant_id", "name");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Calculate current age from date of birth
  let currentAge = 0;
  if (user.user_id?.dob) {
    const birthDate = new Date(user.user_id.dob);
    const today = new Date();
    currentAge = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      currentAge--;
    }
  }

  // If user is an instructor, fetch pricing information
  let pricePerHour = 0;
  if (user.role_id?.name === "instructor") {
    const InstructorPricing = (await import("../../models/instructor_pricing.js")).default;
    const pricing = await InstructorPricing.findOne({
      instructor_id: user._id,
    });

    pricePerHour = pricing ? pricing.price_per_hour : 0;
  }

  // Add price_per_hour and current age to the response
  const responseData = {
    user: {
      ...user.toObject(),
      user_id: {
        ...user.user_id.toObject(),
        age: currentAge // Override the stored age with calculated age
      },
      price_per_hour: pricePerHour
    }
  };

  console.log(responseData);
  res.status(200).json(responseData);
};

// Temporary debug endpoint to check instructor pricing
export const debugInstructorPricing = async (req, res) => {
  try {
    const { id } = req.user;
    const user = await Login.findById(id)
      .select("-password")
      .populate("user_id", "fname lname age dob email phone_number")
      .populate("role_id", "name description")
      .populate("tenant_id", "name");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const InstructorPricing = (await import("../../models/instructor_pricing.js")).default;

    // Get all pricing records
    const allPricing = await InstructorPricing.find({});

    // Get pricing for this specific instructor
    const instructorPricing = await InstructorPricing.findOne({
      instructor_id: user._id,
    });

    res.status(200).json({
      user: {
        id: user._id,
        role: user.role_id?.name,
        email: user.email
      },
      allPricing: allPricing.map(p => ({
        id: p._id,
        instructor_id: p.instructor_id,
        price_per_hour: p.price_per_hour
      })),
      instructorPricing: instructorPricing ? {
        id: instructorPricing._id,
        instructor_id: instructorPricing.instructor_id,
        price_per_hour: instructorPricing.price_per_hour
      } : null
    });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({ error: error.message });
  }
};
