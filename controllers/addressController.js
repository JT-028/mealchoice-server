import User from "../models/User.js";

// @desc    Get user's saved addresses
// @route   GET /api/addresses
// @access  Private
export const getSavedAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("savedAddresses");
    
    res.json({
      success: true,
      addresses: user.savedAddresses || []
    });
  } catch (error) {
    console.error("Get addresses error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching addresses"
    });
  }
};

// @desc    Add new address
// @route   POST /api/addresses
// @access  Private
export const addAddress = async (req, res) => {
  try {
    const { label, fullAddress, barangay, city, province, postalCode, contactPhone, isDefault } = req.body;

    if (!fullAddress) {
      return res.status(400).json({
        success: false,
        message: "Full address is required"
      });
    }

    const user = await User.findById(req.user._id);

    // If this is set as default, unset other defaults
    if (isDefault) {
      user.savedAddresses = user.savedAddresses.map(addr => ({
        ...addr.toObject(),
        isDefault: false
      }));
    }

    // Add new address
    user.savedAddresses.push({
      label: label || "Home",
      fullAddress,
      barangay,
      city,
      province,
      postalCode,
      contactPhone,
      isDefault: isDefault || user.savedAddresses.length === 0 // First address is default
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      addresses: user.savedAddresses
    });
  } catch (error) {
    console.error("Add address error:", error);
    res.status(500).json({
      success: false,
      message: "Server error adding address"
    });
  }
};

// @desc    Update address
// @route   PUT /api/addresses/:id
// @access  Private
export const updateAddress = async (req, res) => {
  try {
    const { label, fullAddress, barangay, city, province, postalCode, contactPhone, isDefault } = req.body;

    const user = await User.findById(req.user._id);
    const addressIndex = user.savedAddresses.findIndex(
      addr => addr._id.toString() === req.params.id
    );

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    // If setting as default, unset others
    if (isDefault) {
      user.savedAddresses = user.savedAddresses.map(addr => ({
        ...addr.toObject(),
        isDefault: false
      }));
    }

    // Update the address
    user.savedAddresses[addressIndex] = {
      ...user.savedAddresses[addressIndex].toObject(),
      label: label || user.savedAddresses[addressIndex].label,
      fullAddress: fullAddress || user.savedAddresses[addressIndex].fullAddress,
      barangay: barangay ?? user.savedAddresses[addressIndex].barangay,
      city: city ?? user.savedAddresses[addressIndex].city,
      province: province ?? user.savedAddresses[addressIndex].province,
      postalCode: postalCode ?? user.savedAddresses[addressIndex].postalCode,
      contactPhone: contactPhone ?? user.savedAddresses[addressIndex].contactPhone,
      isDefault: isDefault ?? user.savedAddresses[addressIndex].isDefault
    };

    await user.save();

    res.json({
      success: true,
      message: "Address updated successfully",
      addresses: user.savedAddresses
    });
  } catch (error) {
    console.error("Update address error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating address"
    });
  }
};

// @desc    Delete address
// @route   DELETE /api/addresses/:id
// @access  Private
export const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addressIndex = user.savedAddresses.findIndex(
      addr => addr._id.toString() === req.params.id
    );

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    const wasDefault = user.savedAddresses[addressIndex].isDefault;
    user.savedAddresses.splice(addressIndex, 1);

    // If deleted address was default and there are remaining addresses, set first as default
    if (wasDefault && user.savedAddresses.length > 0) {
      user.savedAddresses[0].isDefault = true;
    }

    await user.save();

    res.json({
      success: true,
      message: "Address deleted successfully",
      addresses: user.savedAddresses
    });
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting address"
    });
  }
};

// @desc    Set address as default
// @route   PUT /api/addresses/:id/default
// @access  Private
export const setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.savedAddresses.find(
      addr => addr._id.toString() === req.params.id
    );

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    // Unset all defaults, then set the specified one
    user.savedAddresses = user.savedAddresses.map(addr => ({
      ...addr.toObject(),
      isDefault: addr._id.toString() === req.params.id
    }));

    await user.save();

    res.json({
      success: true,
      message: "Default address updated",
      addresses: user.savedAddresses
    });
  } catch (error) {
    console.error("Set default address error:", error);
    res.status(500).json({
      success: false,
      message: "Server error setting default address"
    });
  }
};
