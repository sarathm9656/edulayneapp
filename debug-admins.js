import mongoose from "mongoose";
import SuperAdmin from "./models/superAdmin.model.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = `mongodb://127.0.0.1:27017/Looka_Db`;

async function check() {
    try {
        await mongoose.connect(MONGO_URI, {
            dbName: process.env.DB_NAME,
        });
        console.log("Connected to MongoDB");
        const admins = await SuperAdmin.find({}).select("email is_active");
        console.log("Current Super Admins in DB:", admins);
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

check();
