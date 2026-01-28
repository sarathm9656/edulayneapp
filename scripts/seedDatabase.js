import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Role from "../models/role.model.js";
import SuperAdmin from "../models/superAdmin.model.js";
import Lesson_Type from "../models/Lesson_Type.model.js";
import mongoose from "mongoose";

dotenv.config();

const DEFAULT_ROLE_ID = "682c0541089c54ce890db8b3";

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || `mongodb://127.0.0.1:27017/Looka_Db`;

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      dbName: process.env.DB_NAME,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);
  } catch (error) {
    console.log(error);

    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};


const seedLessonTypes = async () => {
  try {
    console.log("Checking and seeding lesson types...");

    const lessonTypes = [
      { lesson_type: "video" },
      { lesson_type: "pdf" },
      { lesson_type: "quiz" },
      { lesson_type: "live" },
      { lesson_type: "assignment" },
      { lesson_type: "text" },
      { lesson_type: "playground" },
      { lesson_type: "link" },
      { lesson_type: "ppt" },
    ];

    for (const type of lessonTypes) {
      await Lesson_Type.findOneAndUpdate(
        { lesson_type: type.lesson_type },
        type,
        { upsert: true, new: true }
      );
    }

    console.log("Lesson types seeded/updated successfully.");
  } catch (error) {
    console.error("Failed to seed lesson types:", error);
    throw error;
  }
};

const createRoles = async () => {
  try {
    console.log("Checking for standard roles...");

    const rolesToCreate = [
      {
        _id: new mongoose.Types.ObjectId(DEFAULT_ROLE_ID),
        name: "superadmin",
        description: "Super administrator with full system access",
      },
      {
        name: "tenant",
        description: "Tenant administrator",
      },
      {
        name: "instructor",
        description: "Course instructor",
      },
      {
        name: "student",
        description: "Learning student",
      },
    ];

    const results = [];
    for (const roleData of rolesToCreate) {
      let role = await Role.findOne({ name: roleData.name });
      if (!role) {
        role = new Role(roleData);
        await role.save();
        console.log(`Role "${roleData.name}" created.`);
      } else {
        console.log(`Role "${roleData.name}" already exists.`);
      }
      results.push(role);
    }

    return results.find(r => r.name === "superadmin");
  } catch (error) {
    console.error("Failed to create roles:", error);
    throw error;
  }
};


const createSuperAdmin = async (roleId) => {
  try {
    console.log("Checking for existing superadmin user...");
    const email = (process.env.SUPERADMIN_EMAIL || "info@elaynedigital1.com").toLowerCase().trim();
    const password = process.env.SUPERADMIN_PASSWORD || "Elayne@0061";

    const existingSuperAdmin = await SuperAdmin.findOne({ email });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (existingSuperAdmin) {
      console.log(`Super Admin (${email}) already exists. Updating credentials...`);
      existingSuperAdmin.name = "Super Admin";
      existingSuperAdmin.password = hashedPassword;
      existingSuperAdmin.phone_number = process.env.SUPERADMIN_PHONE || "1234567890";
      existingSuperAdmin.role_id = roleId;
      existingSuperAdmin.is_active = true;
      await existingSuperAdmin.save();
      return existingSuperAdmin;
    }

    const superAdmin = await SuperAdmin.create({
      name: "Super Admin",
      email: email,
      password: hashedPassword,
      phone_number: process.env.SUPERADMIN_PHONE || "1234567890",
      role_id: roleId,
      is_active: true,
    });

    console.log("Super Admin created successfully.");
    return superAdmin;
  } catch (error) {
    console.error("Failed to create superadmin:", error);
    throw error;
  }
};


const seedDatabase = async () => {
  try {
    console.log("Starting database seeding process...");

    try {
      await connectDB();
    } catch (error) {
      console.error("Failed to connect to database:", error);
      process.exit(1);
    }

    console.log("\nStep 1: Seeding lesson types...");
    await seedLessonTypes();

    console.log("\nStep 2: Creating roles...");
    const superAdminRole = await createRoles();

    console.log("\nStep 3: Creating superadmin user...");
    await createSuperAdmin(superAdminRole._id);

    console.log("\nDatabase seeding completed successfully!");
    console.log("Super Admin Email:", (process.env.SUPERADMIN_EMAIL || "info@elaynedigital1.com").toLowerCase().trim());
    console.log("Super Admin Password:", process.env.SUPERADMIN_PASSWORD || "Elayne@0061");


    await mongoose.connection.close();
    console.log("Database connection closed.");

    process.exit(0);
  } catch (error) {
    console.error("Database seeding failed:", error);

    try {
      await mongoose.connection.close();
      console.log("Database connection closed.");
    } catch (closeError) {
      console.error("Failed to close database connection:", closeError);
    }

    process.exit(1);
  }
};

seedDatabase();
