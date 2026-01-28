import crypto from 'crypto';
import BatchSubscription from '../../models/Batch_Subscription.js';
import BatchStudent from '../../models/Batch_Students.js';
import { updateSubscriptionStatus } from '../../services/subscriptionService.js';

// Verify Razorpay webhook signature
export const verifyWebhookSignature = (body, signature, secret) => {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    
    return signature === expectedSignature;
};

// Main webhook handler
export const handleRazorpayWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const body = JSON.stringify(req.body);
        const secret = process.env.RZP_WEBHOOK_SECRET;

        // Verify webhook signature
        if (!verifyWebhookSignature(body, signature, secret)) {
            console.error('Invalid webhook signature');
            return res.status(400).json({
                success: false,
                message: 'Invalid signature'
            });
        }

        const event = req.body;
        console.log('Received Razorpay webhook event:', event.event);

        // Process different webhook events
        switch (event.event) {
            case 'subscription.charged':
                await handleSubscriptionCharged(event);
                break;
            case 'subscription.paused':
                await handleSubscriptionPaused(event);
                break;
            case 'subscription.resumed':
                await handleSubscriptionResumed(event);
                break;
            case 'subscription.cancelled':
                await handleSubscriptionCancelled(event);
                break;
            case 'subscription.halted':
                await handleSubscriptionHalted(event);
                break;
            case 'payment.failed':
                await handlePaymentFailed(event);
                break;
            case 'payment.captured':
                await handlePaymentCaptured(event);
                break;
            default:
                console.log(`Unhandled webhook event: ${event.event}`);
        }

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing webhook',
            error: error.message
        });
    }
};

// Handle subscription charged event
const handleSubscriptionCharged = async (event) => {
    try {
        const subscriptionId = event.payload.subscription.entity.id;
        const paymentId = event.payload.payment.entity.id;
        const amount = event.payload.payment.entity.amount;
        const currency = event.payload.payment.entity.currency;

        console.log(`Processing subscription charged for subscription: ${subscriptionId}`);

        const subscription = await BatchSubscription.findOne({
            razorpay_subscription_id: subscriptionId
        });

        if (!subscription) {
            console.error(`Subscription not found for Razorpay ID: ${subscriptionId}`);
            return;
        }

        // Update subscription details
        subscription.status = 'active';
        subscription.last_payment_status = 'success';
        subscription.razorpay_payment_id = paymentId;
        subscription.amount = amount;
        subscription.currency = currency;
        
        // Calculate next billing date (30 days from now)
        const nextBillingDate = new Date();
        nextBillingDate.setDate(nextBillingDate.getDate() + 30);
        subscription.next_billing_date = nextBillingDate;

        await subscription.save();

        // Update batch student status to active
        await BatchStudent.findOneAndUpdate(
            { batch_id: subscription.batch_id, student_id: subscription.user_id },
            { status: 'active' }
        );

        console.log(`Successfully processed subscription charged for user: ${subscription.user_id}, batch: ${subscription.batch_id}`);

    } catch (error) {
        console.error('Error handling subscription charged:', error);
    }
};

// Handle subscription paused event
const handleSubscriptionPaused = async (event) => {
    try {
        const subscriptionId = event.payload.subscription.entity.id;
        console.log(`Processing subscription paused for subscription: ${subscriptionId}`);

        const subscription = await BatchSubscription.findOne({
            razorpay_subscription_id: subscriptionId
        });

        if (!subscription) {
            console.error(`Subscription not found for Razorpay ID: ${subscriptionId}`);
            return;
        }

        subscription.status = 'suspended';
        await subscription.save();

        // Update batch student status to suspended
        await BatchStudent.findOneAndUpdate(
            { batch_id: subscription.batch_id, student_id: subscription.user_id },
            { status: 'suspended' }
        );

        console.log(`Successfully processed subscription paused for user: ${subscription.user_id}, batch: ${subscription.batch_id}`);

    } catch (error) {
        console.error('Error handling subscription paused:', error);
    }
};

// Handle subscription resumed event
const handleSubscriptionResumed = async (event) => {
    try {
        const subscriptionId = event.payload.subscription.entity.id;
        console.log(`Processing subscription resumed for subscription: ${subscriptionId}`);

        const subscription = await BatchSubscription.findOne({
            razorpay_subscription_id: subscriptionId
        });

        if (!subscription) {
            console.error(`Subscription not found for Razorpay ID: ${subscriptionId}`);
            return;
        }

        subscription.status = 'active';
        await subscription.save();

        // Update batch student status to active
        await BatchStudent.findOneAndUpdate(
            { batch_id: subscription.batch_id, student_id: subscription.user_id },
            { status: 'active' }
        );

        console.log(`Successfully processed subscription resumed for user: ${subscription.user_id}, batch: ${subscription.batch_id}`);

    } catch (error) {
        console.error('Error handling subscription resumed:', error);
    }
};

// Handle subscription cancelled event
const handleSubscriptionCancelled = async (event) => {
    try {
        const subscriptionId = event.payload.subscription.entity.id;
        console.log(`Processing subscription cancelled for subscription: ${subscriptionId}`);

        const subscription = await BatchSubscription.findOne({
            razorpay_subscription_id: subscriptionId
        });

        if (!subscription) {
            console.error(`Subscription not found for Razorpay ID: ${subscriptionId}`);
            return;
        }

        subscription.status = 'canceled';
        subscription.canceled_at = new Date();
        await subscription.save();

        // Update batch student status to suspended
        await BatchStudent.findOneAndUpdate(
            { batch_id: subscription.batch_id, student_id: subscription.user_id },
            { status: 'suspended' }
        );

        console.log(`Successfully processed subscription cancelled for user: ${subscription.user_id}, batch: ${subscription.batch_id}`);

    } catch (error) {
        console.error('Error handling subscription cancelled:', error);
    }
};

// Handle subscription halted event
const handleSubscriptionHalted = async (event) => {
    try {
        const subscriptionId = event.payload.subscription.entity.id;
        console.log(`Processing subscription halted for subscription: ${subscriptionId}`);

        const subscription = await BatchSubscription.findOne({
            razorpay_subscription_id: subscriptionId
        });

        if (!subscription) {
            console.error(`Subscription not found for Razorpay ID: ${subscriptionId}`);
            return;
        }

        subscription.status = 'suspended';
        await subscription.save();

        // Update batch student status to suspended
        await BatchStudent.findOneAndUpdate(
            { batch_id: subscription.batch_id, student_id: subscription.user_id },
            { status: 'suspended' }
        );

        console.log(`Successfully processed subscription halted for user: ${subscription.user_id}, batch: ${subscription.batch_id}`);

    } catch (error) {
        console.error('Error handling subscription halted:', error);
    }
};

// Handle payment failed event
const handlePaymentFailed = async (event) => {
    try {
        const subscriptionId = event.payload.subscription.entity.id;
        console.log(`Processing payment failed for subscription: ${subscriptionId}`);

        const subscription = await BatchSubscription.findOne({
            razorpay_subscription_id: subscriptionId
        });

        if (!subscription) {
            console.error(`Subscription not found for Razorpay ID: ${subscriptionId}`);
            return;
        }

        subscription.last_payment_status = 'failed';
        subscription.status = 'suspended';
        await subscription.save();

        // Update batch student status to suspended
        await BatchStudent.findOneAndUpdate(
            { batch_id: subscription.batch_id, student_id: subscription.user_id },
            { status: 'suspended' }
        );

        console.log(`Successfully processed payment failed for user: ${subscription.user_id}, batch: ${subscription.batch_id}`);

    } catch (error) {
        console.error('Error handling payment failed:', error);
    }
};

// Handle payment captured event
const handlePaymentCaptured = async (event) => {
    try {
        const paymentId = event.payload.payment.entity.id;
        const amount = event.payload.payment.entity.amount;
        const currency = event.payload.payment.entity.currency;

        console.log(`Processing payment captured for payment: ${paymentId}`);

        // Find subscription by payment ID
        const subscription = await BatchSubscription.findOne({
            razorpay_payment_id: paymentId
        });

        if (!subscription) {
            console.log(`No subscription found for payment ID: ${paymentId}`);
            return;
        }

        subscription.last_payment_status = 'success';
        subscription.amount = amount;
        subscription.currency = currency;
        await subscription.save();

        console.log(`Successfully processed payment captured for subscription: ${subscription._id}`);

    } catch (error) {
        console.error('Error handling payment captured:', error);
    }
};
