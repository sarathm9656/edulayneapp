import express from "express";
import {
  getPayrollData,
  getInstructorPayrollData,
  processInstructorPayment,
  getPayrollSummary,
  getInstructorPaymentHistory,
  updatePaymentStatus,
  getPaymentStatus,
} from "../../controllers/tenant/payroll.controller.js";
import { authCheckMiddleware } from "../../middleware/authCheckMiddleware.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";

const router = express.Router();

// Get comprehensive payroll data for all instructors
router.get(
  "/data",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  getPayrollData
);

// Get payroll data for a specific instructor
router.get(
  "/instructor/:instructorId",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  getInstructorPayrollData
);

// Process payment for an instructor
router.post(
  "/instructor/:instructorId/payment",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  processInstructorPayment
);

// Update payment status for an instructor
router.put(
  "/instructor/:instructorId/status",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  updatePaymentStatus
);

// Get payment status for an instructor
router.get(
  "/instructor/:instructorId/status",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  getPaymentStatus
);

// Get payroll summary for tenant
router.get(
  "/summary",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  getPayrollSummary
);

// Get payment history for an instructor
router.get(
  "/instructor/:instructorId/history",
  authCheckMiddleware,
  authorizeRoles("tenant"),
  getInstructorPaymentHistory
);

export default router;
