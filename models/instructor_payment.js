import mongoose from "mongoose";

const instructorPaymentSchema = new mongoose.Schema(
  {
    instructor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Login",
      required: true,
    },
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    calculated_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    payment_method: {
      type: String,
      required: true,
      enum: ['manual', 'bank_transfer', 'upi', 'cheque', 'cash'],
      default: 'manual'
    },
    note: {
      type: String,
      trim: true,
      default: ''
    },
    payment_date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'completed'
    },
    total_hours: {
      type: Number,
      required: true,
      min: 0,
    },
    hourly_rate: {
      type: Number,
      required: true,
      min: 0,
    },
    transaction_id: {
      type: String,
      required: true,
    },
    processed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Login",
      required: true,
    }
  },
  {
    timestamps: true,
  }
);

// Create indexes for better query performance
instructorPaymentSchema.index({ instructor_id: 1, payment_date: -1 });
instructorPaymentSchema.index({ tenant_id: 1, payment_date: -1 });
instructorPaymentSchema.index({ transaction_id: 1 }, { unique: true });

// Generate transaction ID before saving
instructorPaymentSchema.pre('save', function(next) {
  if (!this.transaction_id) {
    this.transaction_id = `PAY-${Date.now()}-${this.instructor_id}`;
  }
  next();
});

const InstructorPayment = mongoose.model("InstructorPayment", instructorPaymentSchema);

export default InstructorPayment;
