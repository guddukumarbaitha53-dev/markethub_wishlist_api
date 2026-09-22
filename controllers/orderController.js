const Order = require("../models/orderModel");

/**
 * 1. BUY NOW ORDER CREATION
 * POST /api/orders/buy-now
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

    // Validate required shipping fields
    const missingFields = [];
    if (!shipping_name || !shipping_name.trim()) missingFields.push("shipping_name");
    if (!shipping_phone || !shipping_phone.trim()) missingFields.push("shipping_phone");
    if (!shipping_address || !shipping_address.trim()) missingFields.push("shipping_address");
    if (!shipping_city || !shipping_city.trim()) missingFields.push("shipping_city");
    if (!shipping_state || !shipping_state.trim()) missingFields.push("shipping_state");
    if (!shipping_pincode || !shipping_pincode.trim()) missingFields.push("shipping_pincode");

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required shipping fields: ${missingFields.join(", ")}`,
      });
    }

    // Execute order creation inside transaction
    const order = await Order.createBuyNowOrder({
      userId,
      productId: parseInt(product_id, 10),
      quantity: parsedQuantity,
      paymentMethod: payment_method || "COD",
      shippingDetails: {
        shipping_name: shipping_name.trim(),
        shipping_phone: shipping_phone.trim(),
        shipping_address: shipping_address.trim(),
        shipping_city: shipping_city.trim(),
        shipping_state: shipping_state.trim(),
        shipping_pincode: shipping_pincode.trim(),
      },
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
