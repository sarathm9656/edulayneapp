
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Lesson_Type from './models/Lesson_Type.model.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.DB_NAME,
        });
        console.log("MongoDB connected");
    } catch (err) {
        console.error("Connection error:", err);
        process.exit(1);
    }
};

const checkLessonTypes = async () => {
    await connectDB();
    const types = await Lesson_Type.find({});
    console.log("Existing Lesson Types in DB:", types.map(t => t.lesson_type));
    process.exit(0);
};

checkLessonTypes();
