import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../models/role.model.js";

dotenv.config();

const DEFAULT_ROLE_ID = "682c0541089c54ce890db8b3";

const connectDB = async () => {
    // Construct URI if env vars present, else default
    let MONGO_URI = process.env.MONGO_URI;

    if (!MONGO_URI) {
        if (process.env.MONGO_USER && process.env.MONGO_PASS) {
            MONGO_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.s0xqnyv.mongodb.net`;
        } else {
            MONGO_URI = `mongodb://127.0.0.1:27017/Looka_Db`;
        }
    }

    try {
        const conn = await mongoose.connect(MONGO_URI, {
            dbName: process.env.DB_NAME,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

const createDefaultRole = async () => {
    try {
        await connectDB();
        console.log("Checking for superadmin role...");

        const roleData = {
            _id: new mongoose.Types.ObjectId(DEFAULT_ROLE_ID),
            name: "superadmin",
            description: "Super administrator with full system access",
        };

        let role = await Role.findOne({ name: roleData.name });
        if (!role) {
            // Check if ID exists (rare collision check)
            const roleById = await Role.findById(DEFAULT_ROLE_ID);
            if (roleById) {
                console.log(`Role with ID ${DEFAULT_ROLE_ID} exists but name is different. Skipping.`);
            } else {
                role = new Role(roleData);
                await role.save();
                console.log(`Role "${roleData.name}" created successfully.`);
            }
        } else {
            console.log(`Role "${roleData.name}" already exists.`);
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("Failed to create role:", error);
        await mongoose.connection.close();
        process.exit(1);
    }
};

createDefaultRole();
