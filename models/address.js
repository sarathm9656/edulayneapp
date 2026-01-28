import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  address_line1: { type: String, required: true, trim: true },
  address_line2: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  postal_code: { type: String, trim: true },
  country: { type: String, trim: true },
});

const Address = mongoose.model("Address", addressSchema);

export default Address;
