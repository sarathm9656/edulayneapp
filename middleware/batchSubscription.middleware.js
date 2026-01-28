import BatchSubscription from '../models/Batch_Subscription.js';
import BatchStudent from '../models/Batch_Students.js';

// Middleware to check if user has active subscription for a batch
export const checkBatchSubscription = async (req, res, next) => {
    try {
        const { batch_id } = req.params;
        const user_id = req.user.user_id;

        // Check if user has active subscription for this batch
        const subscription = await BatchSubscription.findOne({
            user_id,
            batch_id,
            status: 'active'
        });

        if (!subscription) {
            return res.status(403).json({
                success: false,
                message: 'You need an active subscription to access this batch',
                requires_subscription: true
            });
        }

        // Check if subscription is not expired
        if (subscription.next_billing_date && subscription.next_billing_date < new Date()) {
            // Update subscription status to suspended
            subscription.status = 'suspended';
            await subscription.save();

            // Update batch student status to suspended
            await BatchStudent.findOneAndUpdate(
                { batch_id, student_id: user_id },
                { status: 'suspended' }
            );

            return res.status(403).json({
                success: false,
                message: 'Your subscription has expired. Please renew to continue accessing this batch',
                subscription_expired: true
            });
        }

        // Add subscription info to request
        req.subscription = subscription;
        next();

    } catch (error) {
        console.error('Error checking batch subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking subscription',
            error: error.message
        });
    }
};

// Middleware to check if user is enrolled in batch (regardless of subscription)
export const checkBatchEnrollment = async (req, res, next) => {
    try {
        const { batch_id } = req.params;
        const user_id = req.user.user_id;

        // Check if user is enrolled in this batch
        const enrollment = await BatchStudent.findOne({
            batch_id,
            student_id: user_id
        });

        if (!enrollment) {
            return res.status(403).json({
                success: false,
                message: 'You are not enrolled in this batch',
                requires_enrollment: true
            });
        }

        // Add enrollment info to request
        req.enrollment = enrollment;
        next();

    } catch (error) {
        console.error('Error checking batch enrollment:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking enrollment',
            error: error.message
        });
    }
};
