const Order = require("../models/orderModel");
const Address = require("../models/addressModel");

/**
 * 0. CHECK ADDRESS STATUS BEFORE ORDERING
 * GET /api/orders/check-address
 */
exports.checkAddress = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User not authenticated.",
      });
    }

    const defaultAddress = await Address.getDefaultAddress(userId);
    const hasAddress = Boolean(defaultAddress);

    return res.status(200).json({
      success: true,
      has_address: hasAddress,
      requires_address: !hasAddress,
      message: hasAddress
        ? "Delivery address is available"
        : "No delivery address found. Please add an address before ordering.",
      data: defaultAddress,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to check address status",
    });
  }
};

/**
 * 1. BUY NOW ORDER CREATION
 * POST /api/orders/buy-now
 * 
 * Condition:
 * - If user has no saved address and provides no address -> prompt user to add address (requires_address: true)
 * - If user already has address filled -> directly place order using default address
 * - If address_id is provided -> place order using selected address
 * - If new address fields provided -> save address and place order directly
 */
exports.buyNow = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User not authenticated.",
      });
    }

    const {
      product_id,
      quantity = 1,
      payment_method = "COD",
      address_id,
      // Legacy shipping fields
      shipping_name,
      shipping_phone,
      shipping_address,
      shipping_city,
      shipping_state,
      shipping_pincode,
    } = req.body;

    // Validate product_id
    if (!product_id || isNaN(product_id) || parseInt(product_id, 10) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid product_id is required",
      });
    }

    // Validate quantity
    const parsedQuantity = parseInt(quantity, 10);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer greater than 0",
      });
    }

    let resolvedShippingDetails = null;

    // Case 1: User explicitly passed address_id
    if (address_id) {
      const selectedAddress = await Address.getAddressById({
        addressId: parseInt(address_id, 10),
        userId,
      });

      if (!selectedAddress) {
        return res.status(404).json({
          success: false,
          message: "Selected address not found or does not belong to you",
        });
      }

      resolvedShippingDetails = {
        shipping_name: selectedAddress.full_name,
        shipping_phone: selectedAddress.mobile_number,
        shipping_address: [
          selectedAddress.house_no,
          selectedAddress.area_street,
          selectedAddress.landmark,
        ]
          .filter(Boolean)
          .join(", "),
        shipping_city: selectedAddress.city,
        shipping_state: selectedAddress.state,
        shipping_pincode: selectedAddress.pincode,
      };
    }
    // Case 2: User provided full new address in body (from Add Address UI)
    else if (
      (req.body.full_name || req.body.fullName) &&
      (req.body.house_no || req.body.houseNo)
    ) {
      const fName = req.body.full_name || req.body.fullName;
      const fMobile = req.body.mobile_number || req.body.mobileNumber;
      const fPincode = req.body.pincode;
      const fState = req.body.state;
      const fCity = req.body.city;
      const fHouseNo = req.body.house_no || req.body.houseNo;
      const fAreaStreet = req.body.area_street || req.body.areaStreet;
      const fLandmark = req.body.landmark;
      const fType = req.body.address_type || req.body.addressType || "Home";
      const fDefault =
        req.body.is_default !== undefined ? req.body.is_default : req.body.isDefault;

      const missing = [];
      if (!fName || !fName.trim()) missing.push("full_name");
      if (!fMobile || !fMobile.trim()) missing.push("mobile_number");
      if (!fPincode || !fPincode.trim()) missing.push("pincode");
      if (!fState || !fState.trim()) missing.push("state");
      if (!fCity || !fCity.trim()) missing.push("city");
      if (!fHouseNo || !fHouseNo.trim()) missing.push("house_no");
      if (!fAreaStreet || !fAreaStreet.trim()) missing.push("area_street");

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          requires_address: true,
          message: `Missing required address fields: ${missing.join(", ")}`,
        });
      }

      // Save new address unless save_address is explicitly false
      if (req.body.save_address !== false) {
        await Address.createAddress({
          userId,
          fullName: fName,
          mobileNumber: fMobile,
          pincode: fPincode,
          state: fState,
          city: fCity,
          houseNo: fHouseNo,
          areaStreet: fAreaStreet,
          landmark: fLandmark,
          addressType: fType,
          isDefault: fDefault,
        });
      }

      resolvedShippingDetails = {
        shipping_name: fName.trim(),
        shipping_phone: fMobile.trim(),
        shipping_address: [fHouseNo, fAreaStreet, fLandmark]
          .filter(Boolean)
          .join(", ")
          .trim(),
        shipping_city: fCity.trim(),
        shipping_state: fState.trim(),
        shipping_pincode: fPincode.trim(),
      };
    }
    // Case 3: Explicit legacy shipping fields provided
    else if (
      shipping_name &&
      shipping_phone &&
      shipping_address &&
      shipping_city &&
      shipping_state &&
      shipping_pincode
    ) {
      resolvedShippingDetails = {
        shipping_name: shipping_name.trim(),
        shipping_phone: shipping_phone.trim(),
        shipping_address: shipping_address.trim(),
        shipping_city: shipping_city.trim(),
        shipping_state: shipping_state.trim(),
        shipping_pincode: shipping_pincode.trim(),
      };
    }
    // Case 4: No address provided in request -> Check user's saved addresses in DB!
    else {
      const defaultAddress = await Address.getDefaultAddress(userId);

      // CONDITION: User has NO address filled in DB -> Ask user to fill address first
      if (!defaultAddress) {
        return res.status(400).json({
          success: false,
          requires_address: true,
          has_address: false,
          message:
            "Shipping address not found. Please add or provide your delivery address before placing an order.",
        });
      }

      // CONDITION: User's address IS filled -> Directly place order using saved address
      resolvedShippingDetails = {
        shipping_name: defaultAddress.full_name,
        shipping_phone: defaultAddress.mobile_number,
        shipping_address: [
          defaultAddress.house_no,
          defaultAddress.area_street,
          defaultAddress.landmark,
        ]
          .filter(Boolean)
          .join(", "),
        shipping_city: defaultAddress.city,
        shipping_state: defaultAddress.state,
        shipping_pincode: defaultAddress.pincode,
      };
    }

    // Execute order creation inside transaction
    const order = await Order.createBuyNowOrder({
      userId,
      productId: parseInt(product_id, 10),
      quantity: parsedQuantity,
      paymentMethod: payment_method || "COD",
      shippingDetails: resolvedShippingDetails,
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        order,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "An unexpected error occurred while placing order",
    });
  }
};

/**
 * 2. GET ORDER HISTORY (PAGINATED)
 * GET /api/orders
 */
exports.getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const result = await Order.getUserOrders({
      userId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: "Order history retrieved successfully",
      count: result.orders.length,
      pagination: result.pagination,
      data: result.orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve order history",
    });
  }
};

/**
 * 3. GET SINGLE ORDER DETAILS
 * GET /api/orders/:orderId
 */
exports.getOrderDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID provided",
      });
    }

    const result = await Order.getOrderById({
      orderId: parseInt(orderId, 10),
      userId,
    });

    if (!result.found) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (result.unauthorized) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You do not have permission to access this order",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order details retrieved successfully",
      data: {
        order: result.order,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve order details",
    });
  }
};

/**
 * 4. CANCEL ORDER WITH STOCK RESTORATION
 * PATCH /api/orders/:orderId/cancel
 */
exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const { cancellation_reason } = req.body;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID provided",
      });
    }

    if (!cancellation_reason || !cancellation_reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required",
      });
    }

    const updatedOrder = await Order.cancelOrder({
      orderId: parseInt(orderId, 10),
      userId,
      cancellationReason: cancellation_reason.trim(),
    });

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        order: updatedOrder,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to cancel order",
    });
  }
};
