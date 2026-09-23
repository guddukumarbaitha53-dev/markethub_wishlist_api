const Address = require("../models/addressModel");

/**
 * 1. ADD NEW ADDRESS
 * POST /api/addresses
 */
exports.addAddress = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User not authenticated.",
      });
    }

    const {
      full_name,
      fullName,
      mobile_number,
      mobileNumber,
      pincode,
      state,
      city,
      house_no,
      houseNo,
      area_street,
      areaStreet,
      landmark,
      address_type,
      addressType,
      is_default,
      isDefault,
    } = req.body;

    const finalFullName = full_name || fullName;
    const finalMobile = mobile_number || mobileNumber;
    const finalPincode = pincode;
    const finalState = state;
    const finalCity = city;
    const finalHouseNo = house_no || houseNo;
    const finalAreaStreet = area_street || areaStreet;
    const finalLandmark = landmark;
    const finalAddressType = address_type || addressType || "Home";
    const finalIsDefault = is_default !== undefined ? is_default : isDefault;

    // Validate required fields matching UI
    const missing = [];
    if (!finalFullName || !finalFullName.trim()) missing.push("full_name (Full Name)");
    if (!finalMobile || !finalMobile.trim()) missing.push("mobile_number (Mobile Number)");
    if (!finalPincode || !finalPincode.trim()) missing.push("pincode (Pincode)");
    if (!finalState || !finalState.trim()) missing.push("state (State)");
    if (!finalCity || !finalCity.trim()) missing.push("city (City)");
    if (!finalHouseNo || !finalHouseNo.trim()) missing.push("house_no (House No / Flat)");
    if (!finalAreaStreet || !finalAreaStreet.trim()) missing.push("area_street (Area / Street)");

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required address fields: ${missing.join(", ")}`,
      });
    }

    // Basic mobile validation (optional format check)
    if (finalMobile.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid mobile number (at least 10 digits)",
      });
    }

    // Basic pincode check
    if (finalPincode.trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid pincode",
      });
    }

    const newAddress = await Address.createAddress({
      userId,
      fullName: finalFullName,
      mobileNumber: finalMobile,
      pincode: finalPincode,
      state: finalState,
      city: finalCity,
      houseNo: finalHouseNo,
      areaStreet: finalAreaStreet,
      landmark: finalLandmark,
      addressType: finalAddressType,
      isDefault: finalIsDefault,
    });

    return res.status(201).json({
      success: true,
      message: "Address saved successfully",
      data: {
        address: newAddress,
      },
    });
  } catch (error) {
    console.error("addAddress error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save address",
    });
  }
};

/**
 * 2. GET ALL SAVED ADDRESSES FOR LOGGED-IN USER
 * GET /api/addresses
 */
exports.getAllAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const addresses = await Address.getUserAddresses(userId);

    return res.status(200).json({
      success: true,
      count: addresses.length,
      data: addresses,
    });
  } catch (error) {
    console.error("getAllAddresses error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve addresses",
    });
  }
};

/**
 * 3. GET DEFAULT SAVED ADDRESS
 * GET /api/addresses/default
 */
exports.getDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const defaultAddress = await Address.getDefaultAddress(userId);

    if (!defaultAddress) {
      return res.status(200).json({
        success: true,
        has_address: false,
        message: "No address found for this user",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      has_address: true,
      message: "Default address retrieved successfully",
      data: defaultAddress,
    });
  } catch (error) {
    console.error("getDefaultAddress error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve default address",
    });
  }
};

/**
 * 4. CHECK IF USER HAS ANY SAVED ADDRESS
 * GET /api/addresses/check
 */
exports.checkAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const defaultAddress = await Address.getDefaultAddress(userId);
    const hasAddress = Boolean(defaultAddress);

    return res.status(200).json({
      success: true,
      has_address: hasAddress,
      requires_address: !hasAddress,
      message: hasAddress
        ? "User address is available"
        : "User has not filled any address. Please fill address.",
      data: defaultAddress,
    });
  } catch (error) {
    console.error("checkAddress error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to check address status",
    });
  }
};

/**
 * 5. GET SINGLE ADDRESS DETAILS
 * GET /api/addresses/:id
 */
exports.getAddressById = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = parseInt(req.params.id, 10);

    if (isNaN(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    const address = await Address.getAddressById({ addressId, userId });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or unauthorized",
      });
    }

    return res.status(200).json({
      success: true,
      data: address,
    });
  } catch (error) {
    console.error("getAddressById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve address",
    });
  }
};

/**
 * 6. UPDATE ADDRESS
 * PUT /api/addresses/:id
 */
exports.updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = parseInt(req.params.id, 10);

    if (isNaN(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    const updated = await Address.updateAddress({
      addressId,
      userId,
      updateData: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: updated,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update address",
    });
  }
};

/**
 * 7. SET ADDRESS AS DEFAULT
 * PATCH /api/addresses/:id/default
 */
exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = parseInt(req.params.id, 10);

    if (isNaN(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    const updated = await Address.setDefaultAddress({ addressId, userId });

    return res.status(200).json({
      success: true,
      message: "Default address updated successfully",
      data: updated,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to set default address",
    });
  }
};

/**
 * 8. DELETE ADDRESS
 * DELETE /api/addresses/:id
 */
exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = parseInt(req.params.id, 10);

    if (isNaN(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID",
      });
    }

    await Address.deleteAddress({ addressId, userId });

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to delete address",
    });
  }
};
