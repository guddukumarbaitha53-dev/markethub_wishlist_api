const fs = require("fs");
const path = require("path");
const db = require("../config/db");

async function runMigration() {
  console.log("Starting database migration for orders...");
  try {
    const sqlPath = path.join(__dirname, "migrations", "create_orders_tables.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // Split SQL by statements ignoring comments
    const statements = sqlContent
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    for (const stmt of statements) {
      console.log("Executing SQL statement...");
      await db.query(stmt);
    }

    console.log("Migration completed successfully! Tables 'orders' and 'order_items' are ready.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed with error:", error);
    process.exit(1);
  }
}

runMigration();
