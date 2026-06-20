-- ═══════════════════════════════════════════════════════════════════════════════
-- PrintFlow ERP — Supabase Setup Script
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Create Employees Table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  phone      VARCHAR(50),
  role       VARCHAR(50) NOT NULL DEFAULT 'OPERATOR',
  department VARCHAR(100),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Auto-update updated_at trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- ─── 3. Enable Row Level Security ──────────────────────────────────────────
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read employees"
  ON employees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert employees"
  ON employees FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update employees"
  ON employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete employees"
  ON employees FOR DELETE TO authenticated USING (true);

-- ─── 4. Seed Data ──────────────────────────────────────────────────────────
INSERT INTO employees (name, email, role, department, phone) VALUES
 