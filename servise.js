require("dotenv").config();
const express = require("express");

const app = express();

app.use(express.json());

// Routes
const wishlistRoutes = require("./routes/wishlistRoutes");
const orderRoutes = require("./routes/orderRoutes");

// Mount Routes
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});