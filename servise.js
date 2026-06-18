const express = require("express");

const app = express();

app.use(express.json());

const wishlistRoutes =
require("./routes/wishlistRoutes");

app.use(
  "/api/wishlist",
  wishlistRoutes
);

app.listen(5000, () => {
  console.log(
    "Server running on port 5000"
  );
});