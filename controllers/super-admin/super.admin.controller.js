import Tenant from "../../models/tenant.model.js";
import Login from "../../models/login.model.js";

import Course from "../../models/Course.js";
import User from "../../models/user.model.js";
import CoursePurchase from "../../models/Course_Purchase.js";

// ! this is used to get all the tenants
export const getTenants = async (req, res) => {
  const tenants = await Tenant.find({}).sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    data: tenants,
  });
};

// ! this is used to get the tenants with the course count and user count
// export const getTenantsWithCourseCountandUserCount = async (req, res) => {
//   try {
//     const tenants = await Tenant.find({});

//     const enrichedTenants = await Promise.all(
//       tenants.map(async (tenant) => {
//         const [courseCount, userCount] = await Promise.all([
//           Course.countDocuments({ tenant_id: tenant._id }),
//           Login.countDocuments({ tenant_id: tenant._id }),
//         ]);

//         return {
//           ...tenant.toObject(),
//           courseCount,
//           userCount,
//         };
//       })
//     );
//     console.log("enrichedTenants", enrichedTenants);

//     res.status(200).json({
//       success: true,
//       data: enrichedTenants,
//     });
//   } catch (error) {
//     console.error("Error fetching tenant metrics:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve tenant data with counts",
//     });
//   }
// };

// Get all tenants with user, login, zoomapikey, courseCount and userCount
export const getTenantsWithCourseCountandUserCount = async (req, res) => {
  try {
    // Get all tenants first, sorted by creation date (newest first)
    const tenants = await Tenant.find().sort({ createdAt: -1 });

    // Get all logins with populated user and tenant data
    const logins = await Login.find({})
      .populate('user_id')
      .populate('tenant_id')
      .populate('role_id');

    const detailedTenants = await Promise.all(
      tenants.map(async (tenant) => {
        // Find the login record for this tenant
        const login = logins.find(l => l.tenant_id && l.tenant_id._id.toString() === tenant._id.toString());

        // Extract user from login
        const user = login?.user_id || null;

        const [courseCount, userCount] = await Promise.all([
          Course.countDocuments({ tenant_id: tenant._id }),
          Login.countDocuments({ tenant_id: tenant._id }),
        ]);


        return {
          tenant: tenant.toObject(),
          user,
          login,
          zoomapikey: null,
          courseCount,
          userCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: detailedTenants.length,
      tenants: detailedTenants,
    });
  } catch (error) {
    console.error("Error fetching tenant details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ! this is used to get the courses by tenant and enrollerd students count
export const getCoursesByTenant = async (req, res) => {
  console.log(
    "req.params =========================================================",
    req.params
  );
  try {
    const { tenantId } = req.params;
    const courses = await Course.find({ tenant_id: tenantId });
    // For each course, fetch purchase details from CoursePurchase
    const coursesWithPurchases = await Promise.all(
      courses.map(async (course) => {
        const purchases = await CoursePurchase.find({
          tenant_id: tenantId,
          course_id: course._id,
        }).populate("user_id"); // Optionally populate user details
        return {
          ...course.toObject(),
          purchases, // or use enrolledStudents: purchases
        };
      })
    );
    console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    console.log(coursesWithPurchases);

    console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");

    res.status(200).json({
      success: true,
      data: coursesWithPurchases,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve courses",
    });
  }
};

export const disableTenant = async (req, res) => {
  console.log(
    "disableTenant ================================================="
  );
  try {
    const { tenantId } = req.params;

    // const LoginUser = await Login.findOneAndUpdate(
    //   { tenant_id: tenantId },
    //   {
    //     is_active: false,
    //   }
    // );
    const LoginUser = await Login.findOne({ tenant_id: tenantId });
    LoginUser.is_active = !LoginUser.is_active;
    LoginUser.save();
    console.log("LoginUser", LoginUser);

    const tenant = await Tenant.findOneAndUpdate(
      { _id: tenantId },
      {
        is_active: false,
      }
    );
    console.log("tenant", tenant);
    console.log(
      "---------------------------------------------------------------------------------------------------------"
    );
    res.status(200).json({
      success: true,
      message: "Tenant disabled successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Failed to disable tenant",
    });
  }
};

export const enableTenant = async (req, res) => {
  console.log("enableTenant =================================================");
  try {
    const { tenantId } = req.params;
    const LoginUser = await Login.findOneAndUpdate(
      { tenant_id: tenantId },
      {
        is_active: true,
      }
    );
    console.log("LoginUser", LoginUser);
    const tenant = await Tenant.findOneAndUpdate(
      { _id: tenantId },
      {
        is_active: true,
      }
    );
    console.log("tenant", tenant);
    console.log(
      "---------------------------------------------------------------------------------------------------------"
    );
    res.status(200).json({
      success: true,
      message: "Tenant enabled successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Failed to enable tenant",
    });
  }
};

// ==========================================================

export const getUsersByTenantSearchQueryAndRoleId = async (req, res) => {
  console.log(
    "getUsersByTenant ================================================="
  );
  try {
    const { tenantId } = req.params;
    const { searchQuery } = req.query;
    const { roleId } = req.query;
    const validTenantId = await Tenant.findById(tenantId);
    if (!validTenantId) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const users = await Login.find({ tenant_id: tenantId })
      .populate("user_id")
      .populate("tenant_id")
      .populate("role_id");
    console.log("users", users);
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Failed to get users",
    });
  }
};
