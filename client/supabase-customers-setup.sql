-- ═══════════════════════════════════════════════════════════════════════════════
-- PrintFlow ERP — Customers Table Setup Script
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customers (
  customer_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code  VARCHAR(50) UNIQUE,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100),
  company        VARCHAR(255),
  email          VARCHAR(255),
  phone          VARCHAR(50),
  address        TEXT,
  gst_number     VARCHAR(50),
  status         VARCHAR(50) DEFAULT 'Active',
  orders_count   INTEGER DEFAULT 0,
  total_revenue  NUMERIC DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_customers'
  ) THEN
    CREATE TRIGGER set_updated_at_customers
      BEFORE UPDATE ON customers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON customers FOR SELECT USING (true);

CREATE POLICY "Allow public insert access"
  ON customers FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON customers FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access"
  ON customers FOR DELETE USING (true);
