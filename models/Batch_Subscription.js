import mongoose from "mongoose";

const batchSubscriptionSchema = new mongoose.Schema({

    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    batch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch',
        required: true
    },
    started_at: {
        type: Date,
        required: true,
        default: Date.now
    },
    next_billing_date: {
        type: Date,
        required: true,
        validate: {
            validator: function(v) {
                return v > this.started_at;
            },
            message: 'Next billing date must be after start date!'
        }
    },
    status: {
        type: String,
        required: true,
        enum: ['active', 'canceled', 'expired', 'suspended', 'pending'],
        default: 'pending'
    },
    last_payment_status: {
        type: String,
        required: true,
        enum: ['success', 'failed', 'pending'],
        default: 'pending'
    },
    canceled_at: {
        type: Date,
        default: null,
        validate: {
            validator: function(v) {
                if (this.status === 'canceled' && !v) {
                    return false;
                }
                return !v || v > this.started_at;
            },
            message: 'Canceled date must be after start date and required when status is canceled!'
        }
    },
    razorpay_subscription_id: {
        type: String,
        required: false
    },
    razorpay_order_id: {
        type: String,
        required: false
    },
    razorpay_payment_id: {
        type: String,
        required: false
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    }
}, {
    timestamps: { 
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Create compound index for user_id and batch_id
batchSubscriptionSchema.index({ user_id: 1, batch_id: 1 });

// Create index for status and next_billing_date for active subscriptions
batchSubscriptionSchema.index({ 
    status: 1, 
    next_billing_date: 1 
}, { 
    partialFilterExpression: { 
        status: 'active'
    }
});

// Create index for last_payment_status
batchSubscriptionSchema.index({ last_payment_status: 1 });

// Create index for razorpay_subscription_id
batchSubscriptionSchema.index({ razorpay_subscription_id: 1 });

// Pre-save middleware to validate subscription status
batchSubscriptionSchema.pre('save', function(next) {
    if (this.isModified('status')) {
        if (this.status === 'canceled' && !this.canceled_at) {
            this.canceled_at = new Date();
        }
        if (this.status !== 'canceled') {
            this.canceled_at = null;
        }
    }
    next();
});

const BatchSubscription = mongoose.model('BatchSubscription', batchSubscriptionSchema);

export default BatchSubscription;
