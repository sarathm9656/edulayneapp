import express from "express";
import {
  generatePassword,
  resendMail,
} from "../../controllers/auth.controller.js";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";

const router = express.Router();

router.post("/generate/password", generatePassword);
router.post("/resend-mail", resendMail);
router.post("/logout", async (req, res) => {
  try {
    console.log("logout");
    res.clearCookie("token");
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error logging out" });
  }
});

// Instructor-specific logout route
router.post(
  "/instructor/logout",
  authCheckMiddleware,
  authorizeRoles("instructor"),
  async (req, res) => {
    try {
      console.log("instructor logout");
      res.clearCookie("token");
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error logging out" });
    }
  }
);

router.get(
  "/check-auth",
  authCheckMiddleware,
  authorizeRoles("tenant", "instructor", "student"),
  (req, res) => {
    const { user } = req;
    console.log(user, "user");
    res.status(200).json({ success: true, user });
  }
);

export default router;
