const express = require("express");

const router = express.Router();

const wishlistController =
require("../controllers/wishlistController");


// ADD
router.post(
  "/add",
  wishlistController.addWishlist
);

// GET ALL
router.get(
  "/:userId",
  wishlistController.getWishlist
);

// CHECK
router.get(
  "/check/:userId/:productId",
  wishlistController.checkWishlist
);

// REMOVE
router.delete(
  "/remove",
  wishlistController.removeWishlist
);

module.exports = router;