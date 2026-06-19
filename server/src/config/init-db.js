/**
 * Database initialization — creates tables if they don't exist.
 * Run once on server startup.
 */
const pool = require("./db");

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(255) NOT NULL,
        email         VARCHAR(255) NOT NULL UNIQUE,
        phone         VARCHAR(50),
        password      VARCHAR(255) NOT NULL,
        role          VARCHAR(50) NOT NULL DEFAULT 'OPERATOR',
        department    VARCHAR(100),
        is_active     BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Auto-update updated_at on row change
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_employees'
        ) THEN
          CREATE TRIGGER set_updated_at_employees
            BEFORE UPDATE ON employees
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END $$;
    `);

    console.log("✅ Database tables initialized");
  } catch (err) {
    console.error("❌ Database init failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = initDatabase;
