import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: process.env.USER_EMAIL,
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendMail = async ({ to, subject, text, html }) => {
  console.log("Email content:", html || text);

  try {
    const info = await transporter.sendMail({
      from: process.env.USER_EMAIL,
      to,
      subject,
      text,
      html,
    });
    console.log("Message sent:", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

export default sendMail;
