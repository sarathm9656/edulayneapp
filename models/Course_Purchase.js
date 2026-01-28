import mongoose from "mongoose";

const coursePurchaseSchema = new mongoose.Schema({

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
    tenant_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Tenant',
        required:true
    },
    purchased_at: {
        type: Date,
        required: true,
        default: Date.now
    },
    valid_till: {
        type: Date,
        default: null,
        validate: {
            validator: function(v) {
                return !v || v > this.purchased_at;
            },
            message: 'Valid till date must be after purchase date!'
        }
    }
}, {
    timestamps: { 
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Create compound index for user_id and course_id to prevent duplicate purchases
coursePurchaseSchema.index({ user_id: 1, course_id: 1 }, { unique: true });

// Create index for purchased_at to efficiently query purchase history
coursePurchaseSchema.index({ purchased_at: 1 });

// Create index for active purchases (where valid_till is null or in future)
coursePurchaseSchema.index({ 
    valid_till: 1 
}, { 
    partialFilterExpression: { 
        $or: [
            { valid_till: null },
            { valid_till: { $gt: new Date() } }
        ]
    }
});

const CoursePurchase = mongoose.model('CoursePurchase', coursePurchaseSchema);

export default CoursePurchase; 