import User from "../models/user.js";
import Address from "../models/address.js";
import UserAddress from "../models/user_address.js";
import mongoose from "mongoose";

// Add a new address for a user
export const addUserAddress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req.params;
    const {
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      address_type,
      is_primary,
    } = req.body;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Validate required address fields
    if (!address_line1 || !city || !country) {
      return res.status(400).json({
        success: false,
        message: "Missing required address fields",
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Create new address
    const address = new Address({
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
    });

    await address.save({ session });

    // If this is set as primary, update other addresses to non-primary
    if (is_primary) {
      await UserAddress.updateMany(
        { user_id: userId, is_primary: true },
        { is_primary: false },
        { session }
      );
    }

    // Create user address mapping
    const userAddress = new UserAddress({
      user_id: userId,
      address_id: address._id,
      address_type: address_type || "home",
      is_primary: is_primary || false,
    });

    await userAddress.save({ session });

    await session.commitTransaction();

    // Get the complete address details
    const completeAddress = await Address.findById(address._id);

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: {
        ...completeAddress.toObject(),
        address_type: userAddress.address_type,
        is_primary: userAddress.is_primary,
      },
    });
  } catch (error) {
    // Only abort transaction if it hasn't been committed yet
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Error adding address:", error);
    res.status(500).json({
      success: false,
      message: "Error adding address",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Get all addresses for a user
export const getUserAddresses = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Get all addresses for the user using aggregation
    const addresses = await UserAddress.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "addresses",
          localField: "address_id",
          foreignField: "_id",
          as: "address",
        },
      },
      { $unwind: "$address" },
      {
        $project: {
          _id: "$address._id",
          address_line1: "$address.address_line1",
          address_line2: "$address.address_line2",
          city: "$address.city",
          state: "$address.state",
          postal_code: "$address.postal_code",
          country: "$address.country",
          address_type: 1,
          is_primary: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching addresses",
      error: error.message,
    });
  }
};

// Update a user's address
export const updateUserAddress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, addressId } = req.params;
    const {
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      address_type,
      is_primary,
    } = req.body;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(addressId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID or address ID",
      });
    }

    // Check if the address belongs to the user
    const userAddress = await UserAddress.findOne({
      user_id: userId,
      address_id: addressId,
    });

    if (!userAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found for this user",
      });
    }

    // Update address details
    const address = await Address.findByIdAndUpdate(
      addressId,
      {
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
      },
      { new: true, session }
    );

    // If setting as primary, update other addresses
    if (is_primary) {
      await UserAddress.updateMany(
        { user_id: userId, address_id: { $ne: addressId }, is_primary: true },
        { is_primary: false },
        { session }
      );
    }

    // Update user address mapping
    const updatedUserAddress = await UserAddress.findOneAndUpdate(
      { user_id: userId, address_id: addressId },
      {
        address_type: address_type || userAddress.address_type,
        is_primary:
          is_primary !== undefined ? is_primary : userAddress.is_primary,
      },
      { new: true, session }
    );

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: {
        ...address.toObject(),
        address_type: updatedUserAddress.address_type,
        is_primary: updatedUserAddress.is_primary,
      },
    });
  } catch (error) {
    // Only abort transaction if it hasn't been committed yet
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Error updating address:", error);
    res.status(500).json({
      success: false,
      message: "Error updating address",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Delete a user's address
export const deleteUserAddress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, addressId } = req.params;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(addressId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID or address ID",
      });
    }

    // Check if the address belongs to the user
    const userAddress = await UserAddress.findOne({
      user_id: userId,
      address_id: addressId,
    });

    if (!userAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found for this user",
      });
    }

    // Delete the user address mapping
    await UserAddress.deleteOne(
      {
        user_id: userId,
        address_id: addressId,
      },
      { session }
    );

    // Delete the address if it's not used by any other user
    const addressUsageCount = await UserAddress.countDocuments({
      address_id: addressId,
    });

    if (addressUsageCount === 0) {
      await Address.deleteOne({ _id: addressId }, { session });
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    // Only abort transaction if it hasn't been committed yet
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Error deleting address:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting address",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Set an address as primary
export const setPrimaryAddress = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, addressId } = req.params;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(addressId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID or address ID",
      });
    }

    // Check if the address belongs to the user
    const userAddress = await UserAddress.findOne({
      user_id: userId,
      address_id: addressId,
    });

    if (!userAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found for this user",
      });
    }

    // Update all addresses to non-primary
    await UserAddress.updateMany(
      { user_id: userId, is_primary: true },
      { is_primary: false },
      { session }
    );

    // Set the selected address as primary
    const updatedUserAddress = await UserAddress.findOneAndUpdate(
      { user_id: userId, address_id: addressId },
      { is_primary: true },
      { new: true, session }
    );

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Primary address updated successfully",
      data: {
        address_id: addressId,
        is_primary: true,
      },
    });
  } catch (error) {
    // Only abort transaction if it hasn't been committed yet
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Error setting primary address:", error);
    res.status(500).json({
      success: false,
      message: "Error setting primary address",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};
