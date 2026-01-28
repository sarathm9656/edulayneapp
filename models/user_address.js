import mongoose from "mongoose";

const userAddressSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  address_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Address",
    required: true,
  },
  address_type: { type: String, trim: true },
  is_primary: { type: Boolean, default: false },
});

const UserAddress = mongoose.model("UserAddress", userAddressSchema);

export default UserAddress;
