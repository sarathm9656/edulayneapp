import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
   
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
    payment_type: {
        type: String,
        required: true,
        enum: ['one_time', 'subscription'],
        default: 'one_time'
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: function(v) {
                return /^\d+(\.\d{0,2})?$/.test(v.toString());
            },
            message: props => `${props.value} must have maximum 2 decimal places!`
        }
    },
    currency: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        minlength: 3,
        maxlength: 3,
        validate: {
            validator: function(v) {
                return /^[A-Z]{3}$/.test(v);
            },
            message: props => `${props.value} is not a valid currency code!`
        }
    },
    payment_status: {
        type: String,
        required: true,
        enum: ['pending', 'success', 'failed'],
        default: 'pending'
    },
    payment_date: {
        type: Date,
        required: true,
        default: Date.now
    },
    subscription_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourseSubscription',
        validate: {
            validator: function(v) {
                // Required only for subscription payments
                return this.payment_type !== 'subscription' || v;
            },
            message: 'Subscription ID is required for subscription payments!'
        }
    },
    transaction_id: {
        type: String,
        required: true,
        trim: true
    },
    payment_method: {
        type: String,
        required: true,
        trim: true,
        enum: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'],
        default: 'credit_card'
    }
}, {
    timestamps: { 
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Create compound index for user_id and course_id
paymentSchema.index({ user_id: 1, course_id: 1 });

// Create index for payment_status and payment_date
paymentSchema.index({ payment_status: 1, payment_date: 1 });

// Create index for transaction_id (unique)
paymentSchema.index({ transaction_id: 1 }, { unique: true });

// Create index for subscription_id
paymentSchema.index({ subscription_id: 1 });

// Pre-save middleware to validate payment type and subscription
paymentSchema.pre('save', function(next) {
    if (this.isModified('payment_type')) {
        if (this.payment_type === 'one_time') {
            this.subscription_id = null;
        }
    }
    next();
});

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment; 