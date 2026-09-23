const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const protect = require("../middleware/authMiddleware");

// All Order routes are protected with JWT authentication
router.use(protect);

// 0. CHECK USER ADDRESS STATUS
router.get("/check-address", orderController.checkAddress);

// 1. BUY NOW ORDER CREATION
router.post("/buy-now", orderController.buyNow);

// 2. GET ORDER HISTORY (PAGINATED - supports both / and /history)
router.get("/", orderController.getOrderHistory);
router.get("/history", orderController.getOrderHistory);

// 3. GET SINGLE ORDER DETAILS
router.get("/:orderId", orderController.getOrderDetails);

// 4. CANCEL ORDER
router.patch("/:orderId/cancel", orderController.cancelOrder);

module.exports = router;
