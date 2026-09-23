-- Migration: Create or update addresses table to match MarketHub UI
-- Fields: Full Name, Mobile Number, Pincode, State, City, House No / Flat, Area / Street, Landmark, Address Type, Set as Default Address

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
  address_type ENUM('Home', 'Office', 'Other') NOT NULL DEFAULT 'Home',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_addresses_user_id (user_id),
  INDEX idx_addresses_is_default (is_default),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
