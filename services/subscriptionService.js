import BatchSubscription from '../models/Batch_Subscription.js';
import BatchStudent from '../models/Batch_Students.js';

// Check if user has active subscription for a batch
export const checkUserBatchSubscription = async (userId, batchId) => {
    try {
        const subscription = await BatchSubscription.findOne({
            user_id: userId,
            batch_id: batchId,
            status: 'active'
        });

        if (!subscription) {
            return { hasSubscription: false, subscription: null };
        }

        // Check if subscription is not expired
        if (subscription.next_billing_date && subscription.next_billing_date < new Date()) {
            // Update subscription status to suspended
            subscription.status = 'suspended';
            await subscription.save();

            // Update batch student status to suspended
            await BatchStudent.findOneAndUpdate(
                { batch_id: batchId, student_id: userId },
                { status: 'suspended' }
            );

            return { hasSubscription: false, subscription, expired: true };
        }

        return { hasSubscription: true, subscription };
    } catch (error) {
        console.error('Error checking batch subscription:', error);
        return { hasSubscription: false, subscription: null, error: error.message };
    }
};

// Get user's batch subscriptions
export const getUserBatchSubscriptions = async (userId) => {
    try {
        const subscriptions = await BatchSubscription.find({ user_id: userId })
            .populate('batch_id', 'batch_name start_date end_date status')
            .sort({ created_at: -1 });

        return { success: true, subscriptions };
    } catch (error) {
        console.error('Error fetching user batch subscriptions:', error);
        return { success: false, error: error.message };
    }
};

// Check if user is enrolled in batch (regardless of subscription)
export const checkUserBatchEnrollment = async (userId, batchId) => {
    try {
        const enrollment = await BatchStudent.findOne({
            batch_id: batchId,
            student_id: userId
        });

        return { isEnrolled: !!enrollment, enrollment };
    } catch (error) {
        console.error('Error checking batch enrollment:', error);
        return { isEnrolled: false, enrollment: null, error: error.message };
    }
};

// Update subscription status based on payment events
export const updateSubscriptionStatus = async (subscriptionId, status, paymentStatus = null) => {
    try {
        const subscription = await BatchSubscription.findById(subscriptionId);
        if (!subscription) {
            return { success: false, error: 'Subscription not found' };
        }

        subscription.status = status;
        if (paymentStatus) {
            subscription.last_payment_status = paymentStatus;
        }

        if (status === 'canceled') {
            subscription.canceled_at = new Date();
        }

        await subscription.save();

        // Update batch student status based on subscription status
        const batchStudentStatus = status === 'active' ? 'active' : 'suspended';
        await BatchStudent.findOneAndUpdate(
            { batch_id: subscription.batch_id, student_id: subscription.user_id },
            { status: batchStudentStatus }
        );

        return { success: true, subscription };
    } catch (error) {
        console.error('Error updating subscription status:', error);
        return { success: false, error: error.message };
    }
};

// Get subscription statistics
export const getSubscriptionStats = async (tenantId) => {
    try {
        const stats = await BatchSubscription.aggregate([
            {
                $lookup: {
                    from: 'batches',
                    localField: 'batch_id',
                    foreignField: '_id',
                    as: 'batch'
                }
            },
            {
                $match: {
                    'batch.tenant_id': tenantId
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        return { success: true, stats };
    } catch (error) {
        console.error('Error fetching subscription stats:', error);
        return { success: false, error: error.message };
    }
};
