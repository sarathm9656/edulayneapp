import express from 'express';
import {
    createBatchSubscription,
    getUserBatchSubscriptions,
    checkBatchSubscription,
    cancelBatchSubscription,
    verifyPayment,
    razorpayWebhook,
    testBatches,
    testRazorpay
} from '../../controllers/batch/batchSubscription.controller.js';
import { authCheckMiddleware } from '../../middleware/authCheckMiddleware.js';

const router = express.Router();

// Webhook route (no auth required)
router.post('/webhook', razorpayWebhook);

// Test routes (no auth required for debugging)
router.get('/test-batches', testBatches);
router.get('/test-razorpay', testRazorpay);

// Protected routes
router.post('/create', authCheckMiddleware, createBatchSubscription);
router.post('/verify-payment', authCheckMiddleware, verifyPayment);
router.get('/user-subscriptions', authCheckMiddleware, getUserBatchSubscriptions);
router.get('/check/:batch_id', authCheckMiddleware, checkBatchSubscription);
router.post('/cancel/:subscription_id', authCheckMiddleware, cancelBatchSubscription);

export default router;
