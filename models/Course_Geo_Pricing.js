import mongoose from "mongoose";

const courseGeoPricingSchema = new mongoose.Schema({

    course_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    country_code: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        minlength: 2,
        maxlength: 2,
        validate: {
            validator: function (v) {
                return /^[A-Z]{2}$/.test(v);
            },
            message: props => `${props.value} is not a valid ISO 3166-1 Alpha-2 country code!`
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
            validator: function (v) {
                return /^[A-Z]{3}$/.test(v);
            },
            message: props => `${props.value} is not a valid currency code!`
        }
    },
    price: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: function (v) {
                return /^\d+(\.\d{0,2})?$/.test(v.toString());
            },
            message: props => `${props.value} must have maximum 2 decimal places!`
        }
    },
    effective_from: {
        type: Date,
        required: true
    },
    effective_to: {
        type: Date,
        default: null,
        validate: {
            validator: function (v) {
                return !v || v > this.effective_from;
            },
            message: 'Effective end date must be after start date!'
        }
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Create compound index for course_id and country_code
courseGeoPricingSchema.index({ course_id: 1, country_code: 1 });

// Create index for effective date range
courseGeoPricingSchema.index({ effective_from: 1, effective_to: 1 });

// Create index for active prices
courseGeoPricingSchema.index({
    effective_from: 1,
    effective_to: 1
}, {
    partialFilterExpression: {
        $or: [
            { effective_to: null },
            { effective_to: { $gt: new Date() } }
        ]
    }
});

const CourseGeoPricing = mongoose.model('CourseGeoPricing', courseGeoPricingSchema);

export default CourseGeoPricing; 