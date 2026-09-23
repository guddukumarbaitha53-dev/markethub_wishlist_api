const express = require("express");
const router = express.Router();
const addressController = require("../controllers/addressController");
const protect = require("../middleware/authMiddleware");

// All Address routes require JWT authentication
router.use(protect);

// 1. Check address status (Does user have any address saved?)
router.get("/check", addressController.checkAddress);

// 2. Get default address
router.get("/default", addressController.getDefaultAddress);

// 3. Add new address (matches the Add Address UI)
router.post("/", addressController.addAddress);

// 4. Get all saved addresses for user
router.get("/", addressController.getAllAddresses);

// 5. Get single address by id
router.get("/:id", addressController.getAddressById);

// 6. Update address by id
router.put("/:id", addressController.updateAddress);

// 7. Set specific address as default
router.patch("/:id/default", addressController.setDefaultAddress);

// 8. Delete address
router.delete("/:id", addressController.deleteAddress);

module.exports = router;
