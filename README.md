# PrintFlow ERP — Job & Employee Management System

PrintFlow ERP is a modern web application designed to streamline print operations, manage jobs, track inventory, monitor production, and manage employees. 

Originally built as a client-server architecture, this project has been migrated to a **frontend-only architecture** utilizing **Supabase** for database operations and user management directly from the browser. This eliminates the need for maintaining a separate Express backend server.

---

## 🏗️ Architecture Overview

- **Frontend**: React + TypeScript + Vite + TailwindCSS (under `client/`)
- **Backend/Database**: Supabase PostgreSQL database
- **Data Access**: Direct connection using `@supabase/supabase-js` client SDK with Row-Level Security (RLS) configured on the tables.

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Supabase](https://supabase.com/) account and project.

### 2. Configure Environment Variables
Navigate to the `client/` directory and create or update the `.env` file:

```bash
cd client
```

Ensure the following variables are set with your Supabase credentials:

```env
# client/.env
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key"
```

### 3. Setup Supabase Database
Go to the **Supabase Dashboard** -> **SQL Editor** -> **New Query**, paste the following SQL script, and click **Run** to set up the `employees` table, setup triggers, configure RLS, and seed the initial admin account:

```sql
-- 1. Reset (warning: deletes existing employees table)
DROP TABLE IF EXISTS employees;

-- 2. Create employees table (holds profiles and credentials)
CREATE TABLE employees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  phone      VARCHAR(50),
  password   VARCHAR(255) NOT NULL,
  role       VARCHAR(50) NOT NULL DEFAULT 'OPERATOR',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Auto-update updated_at column function and trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_employees
  BEFORE UPDATE ON employees 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Allow read and write access for both authenticated and anonymous users
-- (Note: In production, restrict insert/update/delete to specific roles)
CREATE POLICY "Enable read access for all" ON employees FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all" ON employees FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for all" ON employees FOR DELETE USING (true);

-- 6. Seed initial Admin User
INSERT INTO employees (name, email, password, role, phone)
VALUES ('Admin User', 'admin@printflow.com', 'admin123', 'ADMIN', '+91-9800000000')
ON CONFLICT (email) DO NOTHING;
```

---

## 💻 Running the Application

1. **Install Dependencies** (from the `client/` folder):
   ```bash
   cd client
   npm install
   ```

2. **Start the Development Server**:
   ```bash
   npm run dev
   ```

3. **Login Details**:
   - **Email**: `admin@printflow.com`
   - **Password**: `admin123`

---

## 🛠️ Main Features (Direct Supabase Integration)

1. **Authentication**
   - Validates user credentials directly against the `employees` table in Supabase.
   - Saves authenticated user details to `localStorage` to persist sessions.
2. **Employee Management**
   - **Create**: Add new employees with designated roles (Admin, Sales Executive, Supervisor, Operator, etc.) and passwords.
   - **Read**: Live search by name, email, or phone; filter by role or status.
   - **Update**: Edit existing employee details (updates saved to the database).
   - **Soft Delete/Deactivate**: Toggle the status of an employee to "Inactive" to restrict access.
