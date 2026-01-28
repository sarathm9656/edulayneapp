import express from 'express';
import { startBatchClass, joinBatchClass, getBatchRecordings, uploadManualRecording, handleDyteWebhook, syncBatchRecordings } from '../controllers/meetings/dyte.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { upload } from '../config/multer/multer.config.js';

const router = express.Router();

router.post('/create-meeting', authMiddleware, startBatchClass);
router.post('/join-meeting', authMiddleware, joinBatchClass);
router.get('/recordings/:batchId', authMiddleware, getBatchRecordings);
router.post('/upload-recording/:batchId', authMiddleware, upload.single('recording'), uploadManualRecording);
router.post('/sync-recordings/:batchId', authMiddleware, syncBatchRecordings);
router.post('/webhook', express.raw({ type: 'application/json' }), handleDyteWebhook);

export default router;
