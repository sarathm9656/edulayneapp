import express from 'express';
import {
  handleStudentJoin,
  handleStudentLeave,
  getDailyAttendance,
  getMonthlyAttendance,
  getAttendanceByCourseAndBatch,
  generateDailyAttendancePDF,
  generateMonthlyAttendancePDF
} from '../controllers/attendanceController.js';

// Middleware for authentication (using tenant middleware)
import { tenantMiddleware as authenticateToken } from '../middleware/tenant.middleware.js';

const router = express.Router();

// Routes for Dyte integration
router.post('/join-session', authenticateToken, handleStudentJoin);
router.post('/leave-session', authenticateToken, handleStudentLeave);

// Routes for attendance reports
router.get('/daily-summary', authenticateToken, getDailyAttendance);
router.get('/monthly-summary', authenticateToken, getMonthlyAttendance);
router.get('/course-batch-summary', authenticateToken, getAttendanceByCourseAndBatch);

// Routes for PDF generation
router.get('/daily-pdf', authenticateToken, generateDailyAttendancePDF);
router.get('/monthly-pdf', authenticateToken, generateMonthlyAttendancePDF);

export default router;