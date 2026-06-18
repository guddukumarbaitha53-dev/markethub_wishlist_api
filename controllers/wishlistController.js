const Wishlist = require("../models/wishlistModel");


// ADD TO WISHLIST
exports.addWishlist = async (req, res) => {

  try {

    const { user_id, product_id } = req.body;

    const existing =
      await Wishlist.checkWishlist(
        user_id,
        product_id,
      );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Product already exists in wishlist",
      });
    }

    await Wishlist.addWishlist(
      user_id,
      product_id,
    );

    res.status(201).json({
      success: true,
      message: "Added to wishlist",
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// GET USER WISHLIST
exports.getWishlist = async (req, res) => {

  try {

    const { userId } = req.params;

    const wishlist =
      await Wishlist.getWishlist(
        userId,
      );

    res.status(200).json({
      success: true,
      count: wishlist.length,
      data: wishlist,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// CHECK PRODUCT IN WISHLIST
exports.checkWishlist = async (req, res) => {

  try {

    const { userId, productId } =
      req.params;

    const result =
      await Wishlist.checkWishlist(
        userId,
        productId,
      );

    res.status(200).json({
      success: true,
      isWishlist:
          result.length > 0,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// REMOVE WISHLIST
exports.removeWishlist = async (
  req,
  res,
) => {

  try {

    const { user_id, product_id } =
      req.body;

    await Wishlist.removeWishlist(
      user_id,
      product_id,
    );

    res.status(200).json({
      success: true,
      message:
      "Removed from wishlist",
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};