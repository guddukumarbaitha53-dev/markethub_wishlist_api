const db = require("../config/db");

class Address {
  /**
   * Automatically ensure table and columns are configured correctly
   */
  static async ensureTable() {
    try {
      // 1. Create table if not exists
      await db.query(`
        CREATE TABLE IF NOT EXISTS addresses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          mobile_number VARCHAR(20) NOT NULL,
          pincode VARCHAR(10) NOT NULL,
          state VARCHAR(100) NOT NULL,
          city VARCHAR(100) NOT NULL,
          house_no VARCHAR(255) NOT NULL,
          area_street VARCHAR(255) NOT NULL,
          landmark VARCHAR(255) NULL,
          address_type VARCHAR(50) NOT NULL DEFAULT 'Home',
          is_default TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_addresses_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. Check if user_id column exists (in case table was created previously without it)
      const [cols] = await db.query("SHOW COLUMNS FROM addresses LIKE 'user_id'");
      if (cols.length === 0) {
        await db.query(
          "ALTER TABLE addresses ADD COLUMN user_id INT NOT NULL AFTER id, ADD INDEX idx_addresses_user_id (user_id)"
        );
      }
    } catch (err) {
      console.error("Address.ensureTable error:", err.message);
    }
  }

  /**
   * Check if a user has any saved address
   */
  static async hasAddress(userId) {
    await this.ensureTable();
    const [rows] = await db.query(
      "SELECT id FROM addresses WHERE user_id = ? LIMIT 1",
      [userId]
    );
    return rows.length > 0;
  }

  /**
   * Get user's default address (falls back to latest address if no default set)
   */
  static async getDefaultAddress(userId) {
    await this.ensureTable();
    // Try to get address marked as default
    const [defaultRows] = await db.query(
      "SELECT * FROM addresses WHERE user_id = ? AND is_default = 1 LIMIT 1",
      [userId]
    );

    if (defaultRows.length > 0) {
      return defaultRows[0];
    }

    // Fallback to most recently added address
    const [latestRows] = await db.query(
      "SELECT * FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [userId]
    );

    return latestRows.length > 0 ? latestRows[0] : null;
  }

  /**
   * Get single address by ID with user ownership check
   */
  static async getAddressById({ addressId, userId }) {
    await this.ensureTable();
    const [rows] = await db.query(
      "SELECT * FROM addresses WHERE id = ? AND user_id = ?",
      [addressId, userId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all addresses for a user (default first)
   */
  static async getUserAddresses(userId) {
    await this.ensureTable();
    const [rows] = await db.query(
      "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC",
      [userId]
    );
    return rows;
  }

  /**
   * Create a new address matching UI fields:
   * full_name, mobile_number, pincode, state, city, house_no, area_street, landmark, address_type, is_default
   */
  static async createAddress({
    userId,
    fullName,
    mobileNumber,
    pincode,
    state,
    city,
    houseNo,
    areaStreet,
    landmark = null,
    addressType = "Home",
    isDefault = false,
  }) {
    await this.ensureTable();

    // Check existing address count for this user
    const [countRows] = await db.query(
      "SELECT COUNT(*) AS total FROM addresses WHERE user_id = ?",
      [userId]
    );
    const hasExisting = countRows[0].total > 0;

    // First address should automatically be default
    const shouldBeDefault = !hasExisting || isDefault === true || isDefault === 1 || isDefault === "1";

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // If this address is set as default, reset other addresses of this user
      if (shouldBeDefault) {
        await connection.query(
          "UPDATE addresses SET is_default = 0 WHERE user_id = ?",
          [userId]
        );
      }

      const [insertResult] = await connection.query(
        `INSERT INTO addresses (
          user_id,
          full_name,
          mobile_number,
          pincode,
          state,
          city,
          house_no,
          area_street,
          landmark,
          address_type,
          is_default
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          fullName.trim(),
          mobileNumber.trim(),
          pincode.trim(),
          state.trim(),
          city.trim(),
          houseNo.trim(),
          areaStreet.trim(),
          landmark ? landmark.trim() : null,
          addressType ? addressType.trim() : "Home",
          shouldBeDefault ? 1 : 0,
        ]
      );

      await connection.commit();

      const [newAddress] = await db.query(
        "SELECT * FROM addresses WHERE id = ?",
        [insertResult.insertId]
      );

      return newAddress[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update existing address with ownership check
   */
  static async updateAddress({ addressId, userId, updateData }) {
    await this.ensureTable();

    const existing = await this.getAddressById({ addressId, userId });
    if (!existing) {
      const error = new Error("Address not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    const {
      full_name,
      mobile_number,
      pincode,
      state,
      city,
      house_no,
      area_street,
      landmark,
      address_type,
      is_default,
    } = updateData;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const willBeDefault =
        is_default === true || is_default === 1 || is_default === "1";

      if (willBeDefault) {
        await connection.query(
          "UPDATE addresses SET is_default = 0 WHERE user_id = ?",
          [userId]
        );
      }

      await connection.query(
        `UPDATE addresses SET
          full_name = COALESCE(?, full_name),
          mobile_number = COALESCE(?, mobile_number),
          pincode = COALESCE(?, pincode),
          state = COALESCE(?, state),
          city = COALESCE(?, city),
          house_no = COALESCE(?, house_no),
          area_street = COALESCE(?, area_street),
          landmark = ?,
          address_type = COALESCE(?, address_type),
          is_default = COALESCE(?, is_default)
        WHERE id = ? AND user_id = ?`,
        [
          full_name ? full_name.trim() : null,
          mobile_number ? mobile_number.trim() : null,
          pincode ? pincode.trim() : null,
          state ? state.trim() : null,
          city ? city.trim() : null,
          house_no ? house_no.trim() : null,
          area_street ? area_street.trim() : null,
          landmark !== undefined ? (landmark ? landmark.trim() : null) : existing.landmark,
          address_type ? address_type.trim() : null,
          is_default !== undefined ? (willBeDefault ? 1 : 0) : existing.is_default,
          addressId,
          userId,
        ]
      );

      await connection.commit();

      const [updated] = await db.query(
        "SELECT * FROM addresses WHERE id = ?",
        [addressId]
      );
      return updated[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Set specific address as default
   */
  static async setDefaultAddress({ addressId, userId }) {
    await this.ensureTable();

    const existing = await this.getAddressById({ addressId, userId });
    if (!existing) {
      const error = new Error("Address not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        "UPDATE addresses SET is_default = 0 WHERE user_id = ?",
        [userId]
      );

      await connection.query(
        "UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?",
        [addressId, userId]
      );

      await connection.commit();

      const [updated] = await db.query(
        "SELECT * FROM addresses WHERE id = ?",
        [addressId]
      );
      return updated[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete address and reassign default if the deleted address was default
   */
  static async deleteAddress({ addressId, userId }) {
    await this.ensureTable();

    const existing = await this.getAddressById({ addressId, userId });
    if (!existing) {
      const error = new Error("Address not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        "DELETE FROM addresses WHERE id = ? AND user_id = ?",
        [addressId, userId]
      );

      // If the deleted address was default, set the latest remaining address as default
      if (existing.is_default === 1) {
        const [remaining] = await connection.query(
          "SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1",
          [userId]
        );

        if (remaining.length > 0) {
          await connection.query(
            "UPDATE addresses SET is_default = 1 WHERE id = ?",
            [remaining[0].id]
          );
        }
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = Address;
