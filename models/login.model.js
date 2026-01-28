import mongoose from "mongoose";
import bcrypt from "bcrypt";

const loginSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    password: {
      type: String,
      required: false,
      minlength: [8, "Password must be at least 8 characters long"],
    },
    passwordSetupToken: {
      type: String,
      required: false,
    },
    tokenExpiry: {
      type: Date,
      required: false,
    },
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    last_login: {
      type: Date,
    },
    password_changed_at: {
      type: Date,
    },
    password_reset_token: String,
    password_reset_expires: Date,
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure unique email per tenant
loginSchema.index({ email: 1, tenant_id: 1 }, { unique: true });

// Pre-save middleware to hash password
loginSchema.pre("save", async function (next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified("password")) return next();

  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    // Hash password
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
loginSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Method to check if password was changed after a certain timestamp
loginSchema.methods.changedPasswordAfter = function (timestamp) {
  if (this.password_changed_at) {
    const changedTimestamp = parseInt(
      this.password_changed_at.getTime() / 1000,
      10
    );
    return timestamp < changedTimestamp;
  }
  return false;
};

const Login = mongoose.model("Login", loginSchema);

export default Login;
