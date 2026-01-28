import Permission from "../../models/permissions.models.js";

export const createPermission = async (req, res) => {
  try {
    const { name } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    // Check if permission already exists
    const existingPermission = await Permission.findOne({ name });
    if (existingPermission) {
      return res.status(400).json({
        success: false,
        message: "Permission with this name already exists",
      });
    }

    // Create permission
    const permission = new Permission({
      name: name.toLowerCase().trim(),
      is_active: true,
    });

    await permission.save();

    res.status(201).json({
      success: true,
      message: "Permission created successfully",
      data: permission,
    });
  } catch (error) {
    console.error("Create permission error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAllPermissions = async (req, res) => {
  try {
    // const { is_active } = req.query;

    // // Build filter
    // const filter = {};
    // if (is_active !== undefined) {
    //   filter.is_active = is_active === "true";
    // }

    const permissions = await Permission.find().sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: permissions,
      count: permissions.length,
    });
  } catch (error) {
    console.error("Get permissions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    const permission = await Permission.findById(id);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    // Check if new name conflicts with existing permission
    if (name && name !== permission.name) {
      const existingPermission = await Permission.findOne({ name });
      if (existingPermission) {
        return res.status(400).json({
          success: false,
          message: "Permission with this name already exists",
        });
      }
      permission.name = name.toLowerCase().trim();
    }

    // Update is_active if provided
    if (is_active !== undefined) {
      permission.is_active = is_active;
    }

    await permission.save();

    res.status(200).json({
      success: true,
      message: "Permission updated successfully",
      data: permission,
    });
  } catch (error) {
    console.error("Update permission error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;

    const permission = await Permission.findById(id);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found",
      });
    }

    // Soft delete by setting is_active to false
    permission.is_active = false;
    await permission.save();

    res.status(200).json({
      success: true,
      message: "Permission deleted successfully",
    });
  } catch (error) {
    console.error("Delete permission error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get permissions by module
export const getPermissionsByModule = async (req, res) => {
  try {
    const { module } = req.params;

    const permissions = await Permission.find({
      module,
      is_active: true,
    }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: permissions,
      module,
    });
  } catch (error) {
    console.error("Get permissions by module error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
