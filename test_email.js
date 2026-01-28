
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

console.log("Testing Email Configuration...");
console.log("User:", process.env.USER_EMAIL);
console.log("Pass length:", process.env.GOOGLE_APP_PASSWORD ? process.env.GOOGLE_APP_PASSWORD.length : 0);

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.GOOGLE_APP_PASSWORD,
    },
});

transporter.verify(function (error, success) {
    if (error) {
        console.log("Connection check failed:", error);
    } else {
        console.log("Server is ready to take our messages");
    }
});
