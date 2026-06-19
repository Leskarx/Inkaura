const { Pool } = require("pg");

const isProduction = process.env.DATABASE_URL?.includes("render.com");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isProduction && { ssl: { rejectUnauthorized: false } }),
});

// Test connection on startup
pool.query("SELECT NOW()")
  .then(() => console.log("✅ PostgreSQL connected"))
  .catch((err) => console.error("❌ PostgreSQL connection failed:", err.message));

module.exports = pool;
