import mongoose from "mongoose";

const courseSubscriptionSchema = new mongoose.Schema({

    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    course_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
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
        enum: ['active', 'canceled', 'expired'],
        default: 'active'
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
    }
}, {
    timestamps: { 
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Create compound index for user_id and course_id
courseSubscriptionSchema.index({ user_id: 1, course_id: 1 });

// Create index for status and next_billing_date for active subscriptions
courseSubscriptionSchema.index({ 
    status: 1, 
    next_billing_date: 1 
}, { 
    partialFilterExpression: { 
        status: 'active'
    }
});

// Create index for last_payment_status
courseSubscriptionSchema.index({ last_payment_status: 1 });

// Pre-save middleware to validate subscription status
courseSubscriptionSchema.pre('save', function(next) {
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

const CourseSubscription = mongoose.model('CourseSubscription', courseSubscriptionSchema);

export default CourseSubscription; 