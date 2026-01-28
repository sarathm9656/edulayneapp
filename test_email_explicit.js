
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

console.log("Testing Explicit Email Configuration...");

// Try implicit first
const transporter1 = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.GOOGLE_APP_PASSWORD,
    },
    tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false,
    },
});

transporter1.verify(function (error, success) {
    if (error) {
        console.log("Transporter 1 (465) failed:", error);
    } else {
        console.log("Transporter 1 (465) is ready!");
    }
});
