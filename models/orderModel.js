const db = require("../config/db");

class Order {
  /**
   * Create a Buy Now Order inside a MySQL transaction
   */
  static async createBuyNowOrder({
    userId,
    productId,
    quantity,
    paymentMethod,
    shippingDetails,
  }) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Fetch product with FOR UPDATE row lock to prevent race conditions
      const [products] = await connection.query(
        `SELECT id, title, price, discount_price, stock, status, shipping_charge, image1 
         FROM products 
         WHERE id = ? FOR UPDATE`,
        [productId]
      );

      if (products.length === 0) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
      }

      const product = products[0];

      // 2. Check product status
      if (product.status && product.status.toLowerCase() !== "active") {
        const error = new Error("Product is currently unavailable or inactive");
        error.statusCode = 400;
        throw error;
      }

      // 3. Validate stock
      const availableStock = parseInt(product.stock, 10) || 0;
      if (availableStock <= 0) {
        const error = new Error("Product is out of stock");
        error.statusCode = 409;
        throw error;
      }

      if (quantity > availableStock) {
        const error = new Error(
          `Insufficient stock available. Only ${availableStock} item(s) left in stock`
        );
        error.statusCode = 409;
        throw error;
      }

      // 4. Calculate prices strictly from database
      const originalPrice = parseFloat(product.price);
      const discountPrice =
        product.discount_price !== null && parseFloat(product.discount_price) > 0
          ? parseFloat(product.discount_price)
          : null;

      const unitPrice = discountPrice !== null ? discountPrice : originalPrice;
      const subtotal = originalPrice * quantity;
      const discountAmount = (originalPrice - unitPrice) * quantity;
      const itemsTotalPrice = unitPrice * quantity;
      const shippingCharge =
        product.shipping_charge !== null && parseFloat(product.shipping_charge) > 0
          ? parseFloat(product.shipping_charge)
          : 0.0;
      const totalAmount = itemsTotalPrice + shippingCharge;

      // 5. Generate unique order number
      const timestamp = Date.now();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `MH-${timestamp}-${randomSuffix}`;

      // Default COD status
      const paymentStatus = "PENDING";
      const orderStatus = "PLACED";

      // 6. Insert Order Record
      const [orderResult] = await connection.query(
        `INSERT INTO orders (
          user_id,
          order_number,
          total_amount,
          subtotal,
          shipping_charge,
          discount_amount,
          payment_method,
          payment_status,
          order_status,
          shipping_name,
          shipping_phone,
          shipping_address,
          shipping_city,
          shipping_state,
          shipping_pincode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          orderNumber,
          totalAmount.toFixed(2),
          subtotal.toFixed(2),
          shippingCharge.toFixed(2),
          discountAmount.toFixed(2),
          paymentMethod || "COD",
          paymentStatus,
          orderStatus,
          shippingDetails.shipping_name,
          shippingDetails.shipping_phone,
          shippingDetails.shipping_address,
          shippingDetails.shipping_city,
          shippingDetails.shipping_state,
          shippingDetails.shipping_pincode,
        ]
      );

      const orderId = orderResult.insertId;

      // 7. Insert Snapshot into order_items
      await connection.query(
        `INSERT INTO order_items (
          order_id,
          product_id,
          product_title,
          product_image,
          quantity,
          price,
          discount_price,
          total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          product.id,
          product.title,
          product.image1 || null,
          quantity,
          originalPrice.toFixed(2),
          discountPrice !== null ? discountPrice.toFixed(2) : null,
          itemsTotalPrice.toFixed(2),
        ]
      );

      // 8. Safely reduce product stock atomically
      const [stockUpdate] = await connection.query(
        `UPDATE products 
         SET stock = stock - ? 
         WHERE id = ? AND stock >= ?`,
        [quantity, product.id, quantity]
      );

      if (stockUpdate.affectedRows === 0) {
        const error = new Error(
          "Stock deduction failed due to concurrent update. Please try again."
        );
        error.statusCode = 409;
        throw error;
      }

      // Commit transaction
      await connection.commit();

      // 9. Fetch complete created order with items
      const [newOrderRows] = await db.query(
        `SELECT * FROM orders WHERE id = ?`,
        [orderId]
      );
      const [itemRows] = await db.query(
        `SELECT * FROM order_items WHERE order_id = ?`,
        [orderId]
      );

      return {
        ...newOrderRows[0],
        items: itemRows,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get paginated order history for logged-in user
   */
  static async getUserOrders({ userId, page = 1, limit = 10 }) {
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNumber - 1) * limitNumber;

    // Total count for pagination
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM orders WHERE user_id = ?`,
      [userId]
    );
    const totalOrders = countRows[0].total;
    const totalPages = Math.ceil(totalOrders / limitNumber);

    // Fetch orders with item count & first item thumbnail
    const [orders] = await db.query(
      `SELECT 
        o.id,
        o.user_id,
        o.order_number,
        o.total_amount,
        o.subtotal,
        o.shipping_charge,
        o.discount_amount,
        o.payment_method,
        o.payment_status,
        o.order_status,
        o.shipping_name,
        o.shipping_city,
        o.cancellation_reason,
        o.cancelled_at,
        o.created_at,
        o.updated_at,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
        (SELECT oi.product_image FROM order_items oi WHERE oi.order_id = o.id LIMIT 1) AS first_product_image,
        (SELECT oi.product_title FROM order_items oi WHERE oi.order_id = o.id LIMIT 1) AS first_product_title
       FROM orders o
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limitNumber, offset]
    );

    return {
      orders,
      pagination: {
        totalOrders,
        totalPages,
        currentPage: pageNumber,
        limit: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    };
  }

  /**
   * Get single order details with ownership verification
   */
  static async getOrderById({ orderId, userId }) {
    const [orders] = await db.query(
      `SELECT * FROM orders WHERE id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return { found: false };
    }

    const order = orders[0];

    // Security check: order must belong to user
    if (order.user_id !== userId) {
      return { found: true, unauthorized: true };
    }

    // Fetch order items snapshot
    const [items] = await db.query(
      `SELECT 
        id,
        order_id,
        product_id,
        product_title,
        product_image,
        quantity,
        price,
        discount_price,
        total_price,
        created_at
       FROM order_items 
       WHERE order_id = ?`,
      [orderId]
    );

    return {
      found: true,
      unauthorized: false,
      order: {
        ...order,
        items,
      },
    };
  }

  /**
   * Cancel an order inside a transaction and restore stock safely
   */
  static async cancelOrder({ orderId, userId, cancellationReason }) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Fetch order with lock
      const [orders] = await connection.query(
        `SELECT * FROM orders WHERE id = ? FOR UPDATE`,
        [orderId]
      );

      if (orders.length === 0) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
      }

      const order = orders[0];

      // 2. Ownership verification
      if (order.user_id !== userId) {
        const error = new Error("Unauthorized to cancel this order");
        error.statusCode = 403;
        throw error;
      }

      // 3. Check if already cancelled
      if (order.order_status === "CANCELLED") {
        const error = new Error("This order has already been cancelled");
        error.statusCode = 409;
        throw error;
      }

      // 4. Validate cancellable status
      const cancellableStatuses = ["PLACED", "CONFIRMED"];
      if (!cancellableStatuses.includes(order.order_status)) {
        const error = new Error(
          `Order cannot be cancelled in its current status: '${order.order_status}'. Cancellation is only allowed for PLACED or CONFIRMED orders.`
        );
        error.statusCode = 400;
        throw error;
      }

      // 5. Update order status and record cancellation details
      await connection.query(
        `UPDATE orders 
         SET order_status = 'CANCELLED',
             cancellation_reason = ?,
             cancelled_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [cancellationReason, orderId]
      );

      // 6. Fetch items to restore stock
      const [items] = await connection.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
        [orderId]
      );

      // 7. Restore stock for each item
      for (const item of items) {
        await connection.query(
          `UPDATE products 
           SET stock = stock + ? 
           WHERE id = ?`,
          [item.quantity, item.product_id]
        );
      }

      await connection.commit();

      // Return updated order
      const [updatedOrders] = await db.query(
        `SELECT * FROM orders WHERE id = ?`,
        [orderId]
      );
      const [updatedItems] = await db.query(
        `SELECT * FROM order_items WHERE order_id = ?`,
        [orderId]
      );

      return {
        ...updatedOrders[0],
        items: updatedItems,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = Order;
