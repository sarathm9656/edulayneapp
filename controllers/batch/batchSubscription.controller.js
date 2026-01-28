import BatchSubscription from '../../models/Batch_Subscription.js';
import Batch from '../../models/Batch_table.js';
import BatchStudent from '../../models/Batch_Students.js';
import User from '../../models/user.model.js';
import razorpay from '../../config/razorpay.js';
import { RazorpayPlanManager } from '../../utils/razorpayPlanManager.js';
import crypto from 'crypto';
import mongoose from 'mongoose';

// Create subscription for a batch
export const createBatchSubscription = async (req, res) => {
    try {
        const { batch_id, amount } = req.body;
        const user_id = req.user.id || req.user._id;

        console.log('Creating subscription for batch_id:', batch_id, 'user_id:', user_id, 'amount:', amount);

        // Check if user already has an active subscription for this batch
        const existingSubscription = await BatchSubscription.findOne({
            user_id,
            batch_id,
            status: { $in: ['active', 'pending'] }
        });

        if (existingSubscription) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active subscription for this batch'
            });
        }

        // Get batch details
        let batch;
        try {
            const objectId = new mongoose.Types.ObjectId(batch_id);
            batch = await Batch.findById(objectId);
        } catch (error) {
            console.error('Error finding batch:', error);
            return res.status(400).json({
                success: false,
                message: 'Invalid batch ID format',
                error: error.message
            });
        }
        
        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        // Check if subscription is enabled for this batch
        if (!batch.subscription_enabled) {
            return res.status(400).json({
                success: false,
                message: 'Subscription is not enabled for this batch'
            });
        }

        // Create Razorpay order for payment
        const planAmount = amount || batch.subscription_price || 1000;
        const amountInPaise = planAmount * 100; // Convert to paise

        try {
            console.log('Creating Razorpay order with amount:', amountInPaise);
            // Create Razorpay order
            const order = await razorpay.orders.create({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `sub_${Date.now()}`, // Shortened receipt to meet 40 char limit
                notes: {
                    batch_id: batch_id,
                    user_id: user_id,
                    batch_name: batch.batch_name,
                    subscription_type: 'monthly'
                }
            });
            console.log('Razorpay order created successfully:', order.id);

            // Create pending subscription record
            const batchSubscription = new BatchSubscription({
                user_id,
                batch_id,
                amount: planAmount,
                currency: 'INR',
                razorpay_order_id: order.id,
                started_at: new Date(),
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'pending',
                last_payment_status: 'pending'
            });

            await batchSubscription.save();

            res.status(200).json({
                success: true,
                message: 'Order created successfully',
                order: {
                    id: order.id,
                    amount: order.amount,
                    currency: order.currency,
                    receipt: order.receipt
                },
                subscription: batchSubscription,
                batch_name: batch.batch_name
            });

        } catch (razorpayError) {
            console.error('Razorpay order creation failed:', razorpayError);
            res.status(500).json({
                success: false,
                message: 'Failed to create payment order',
                error: razorpayError.message
            });
        }

    } catch (error) {
        console.error('Error creating batch subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating subscription',
            error: error.message
        });
    }
};

// Verify payment and update subscription
export const verifyPayment = async (req, res) => {
    try {
        const { order_id, payment_id, signature } = req.body;
        const user_id = req.user.id || req.user._id;

        console.log('Verifying payment for order_id:', order_id, 'user_id:', user_id);

        // Find the subscription by order_id
        const subscription = await BatchSubscription.findOne({
            razorpay_order_id: order_id,
            user_id: user_id
        });

        if (!subscription) {
            console.log('Subscription not found for order_id:', order_id);
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        console.log('Found subscription before update:', {
            id: subscription._id,
            status: subscription.status,
            batch_id: subscription.batch_id
        });

        // Verify payment signature (in production, you should verify with Razorpay)
        // For now, we'll assume the payment is successful
        subscription.razorpay_payment_id = payment_id;
        subscription.status = 'active';
        subscription.last_payment_status = 'success';
        subscription.started_at = new Date();
        subscription.next_billing_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await subscription.save();

        console.log('Subscription updated successfully:', {
            id: subscription._id,
            status: subscription.status,
            batch_id: subscription.batch_id
        });

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            subscription: subscription
        });

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying payment',
            error: error.message
        });
    }
};

// Get user's batch subscriptions
export const getUserBatchSubscriptions = async (req, res) => {
    try {
        const user_id = req.user.id || req.user._id;

        const subscriptions = await BatchSubscription.find({ user_id })
            .populate('batch_id', 'batch_name start_date end_date status')
            .sort({ created_at: -1 });

        res.status(200).json({
            success: true,
            subscriptions
        });

    } catch (error) {
        console.error('Error fetching batch subscriptions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching subscriptions',
            error: error.message
        });
    }
};

// Check if user is subscribed to a batch
export const checkBatchSubscription = async (req, res) => {
    try {
        const { batch_id } = req.params;
        const user_id = req.user.id || req.user._id;

        console.log('Checking subscription for batch_id:', batch_id, 'user_id:', user_id);

        // First, let's check if there's ANY subscription for this batch
        const anySubscription = await BatchSubscription.findOne({
            user_id,
            batch_id
        });

        console.log('Any subscription found:', anySubscription ? 'Yes' : 'No');
        if (anySubscription) {
            console.log('Any subscription details:', {
                id: anySubscription._id,
                status: anySubscription.status,
                started_at: anySubscription.started_at,
                next_billing_date: anySubscription.next_billing_date
            });
        }

        // Then check for active or pending subscription
        const subscription = await BatchSubscription.findOne({
            user_id,
            batch_id,
            status: { $in: ['active', 'pending'] }
        });

        console.log('Active/Pending subscription found:', subscription ? 'Yes' : 'No');
        if (subscription) {
            console.log('Active/Pending subscription details:', {
                id: subscription._id,
                status: subscription.status,
                started_at: subscription.started_at,
                next_billing_date: subscription.next_billing_date
            });
        }

        res.status(200).json({
            success: true,
            is_subscribed: !!subscription,
            subscription: subscription || null
        });

    } catch (error) {
        console.error('Error checking batch subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking subscription',
            error: error.message
        });
    }
};

// Cancel batch subscription
export const cancelBatchSubscription = async (req, res) => {
    try {
        const { subscription_id } = req.params;
        const user_id = req.user.id || req.user._id;

        const subscription = await BatchSubscription.findOne({
            _id: subscription_id,
            user_id
        });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        // Cancel Razorpay subscription
        if (subscription.razorpay_subscription_id) {
            await razorpay.subscriptions.cancel(subscription.razorpay_subscription_id);
        }

        // Update subscription status
        subscription.status = 'canceled';
        subscription.canceled_at = new Date();
        await subscription.save();

        // Update batch student status to suspended
        await BatchStudent.findOneAndUpdate(
            { batch_id: subscription.batch_id, student_id: user_id },
            { status: 'suspended' }
        );

        res.status(200).json({
            success: true,
            message: 'Subscription canceled successfully'
        });

    } catch (error) {
        console.error('Error canceling batch subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error canceling subscription',
            error: error.message
        });
    }
};

// Import the webhook handler
import { handleRazorpayWebhook } from '../razorpay/razorpayWebhook.controller.js';

// Razorpay webhook handler
export const razorpayWebhook = handleRazorpayWebhook;

// Test endpoint to check batches
export const testBatches = async (req, res) => {
    try {
        const batches = await Batch.find({}).limit(10);
        res.status(200).json({
            success: true,
            message: 'Batches found',
            count: batches.length,
            batches: batches.map(batch => ({
                id: batch._id,
                name: batch.batch_name,
                subscription_price: batch.subscription_price,
                subscription_enabled: batch.subscription_enabled
            }))
        });
    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching batches',
            error: error.message
        });
    }
};

// Test Razorpay configuration
export const testRazorpay = async (req, res) => {
    try {
        console.log('Testing Razorpay configuration...');
        console.log('RZP_KEY_ID:', process.env.RZP_KEY_ID ? 'Set' : 'Not set');
        console.log('RZP_KEY_SECRET:', process.env.RZP_KEY_SECRET ? 'Set' : 'Not set');
        
        // Try to create a test order
        const testOrder = await razorpay.orders.create({
            amount: 100, // 1 rupee in paise
            currency: 'INR',
            receipt: 'test_order'
        });
        
        res.status(200).json({
            success: true,
            message: 'Razorpay configuration is working',
            test_order_id: testOrder.id
        });
    } catch (error) {
        console.error('Razorpay test failed:', error);
        res.status(500).json({
            success: false,
            message: 'Razorpay configuration failed',
            error: error.message
        });
    }
};

