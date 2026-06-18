const db = require("../config/db");

class Wishlist {

  static async addWishlist(userId, productId) {

    const [result] = await db.query(
      `INSERT INTO wishlist
      (user_id, product_id)
      VALUES (?, ?)`,
      [userId, productId]
    );

    return result;
  }

  static async checkWishlist(userId, productId) {

    const [rows] = await db.query(
      `SELECT *
       FROM wishlist
       WHERE user_id = ?
       AND product_id = ?`,
      [userId, productId]
    );

    return rows;
  }

  static async getWishlist(userId) {

    const [rows] = await db.query(
      `
      SELECT
      w.id AS wishlist_id,
      p.id,
      p.title,
      p.description,
      p.price,
      p.discount_price,
      p.image1

      FROM wishlist w

      INNER JOIN products p
      ON p.id = w.product_id

      WHERE w.user_id = ?
      ORDER BY w.id DESC
      `,
      [userId]
    );

    return rows;
  }

  static async removeWishlist(userId, productId) {

    const [result] = await db.query(
      `
      DELETE FROM wishlist
      WHERE user_id = ?
      AND product_id = ?
      `,
      [userId, productId]
    );

    return result;
  }
}

module.exports = Wishlist;