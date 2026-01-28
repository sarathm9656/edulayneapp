
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Lesson_Type from './models/Lesson_Type.model.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/Looka_Db");
        const count = await Lesson_Type.countDocuments();
        const types = await Lesson_Type.find({});
        const output = `Count: ${count}\nTypes: ${types.map(t => t.lesson_type).join(', ')}`;
        fs.writeFileSync('debug_output.txt', output);
        console.log("Done");
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('debug_output.txt', `Error: ${e.message}`);
        process.exit(1);
    }
};

run();
