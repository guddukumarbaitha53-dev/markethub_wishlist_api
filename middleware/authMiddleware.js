const jwt = require("jsonwebtoken");
const db = require("../config/db");

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access denied. Authentication token is missing.",
        });
      }

      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token. Please log in again.",
        });
      }

      // Find user in DB
      const [users] = await db.query(
        "SELECT id, name, email, phone FROM users WHERE id = ?",
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: "User not found or account is invalid.",
        });
      }

      req.user = users[0];
      next();
    } else {
      return res.status(401).json({
        success: false,
        message: "Access denied. Bearer token not provided.",
      });
    }
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(401).json({
      success: false,
      message: "Authentication failed. " + error.message,
    });
  }
};

module.exports = protect;
