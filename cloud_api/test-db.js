import { pool } from "./db.js";

try {
  const [rows] = await pool.query("SELECT NOW() AS now");
  console.log("✅ Database connected! Current time:", rows[0].now);
  process.exit(0);
} catch (err) {
  console.error("❌ Database connection failed:", err);
  process.exit(1);
}
