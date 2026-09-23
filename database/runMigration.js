const fs = require("fs");
const path = require("path");
const db = require("../config/db");

async function runMigration() {
  console.log("Starting database migrations...");
  try {
    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));

    for (const file of files) {
      console.log(`\nRunning migration file: ${file}`);
      const sqlPath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(sqlPath, "utf8");

      const statements = sqlContent
        .split(";")
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0);

      for (const stmt of statements) {
        await db.query(stmt);
      }
      console.log(`Finished: ${file}`);
    }

    console.log("\nAll migrations completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed with error:", error);
    process.exit(1);
  }
}

runMigration();
