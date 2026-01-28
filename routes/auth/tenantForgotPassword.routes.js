import express from "express";
import {
  tenantForgotPassword,
  tenantResetPassword,
} from "../../controllers/auth/tenantForgotPassword.controller.js";

const router = express.Router();

// Tenant Users Forgot Password Routes
router.post("/forgot-password", tenantForgotPassword);
router.post("/reset-password", tenantResetPassword);

export default router;
