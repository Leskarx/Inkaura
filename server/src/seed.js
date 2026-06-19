require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./config/db");
const initDatabase = require("./config/init-db");

async function seed() {
  console.log("🌱 Seeding database...\n");

  // Ensure table exists
  await initDatabase();

  const adminEmail = "admin@printflow.com";
  const existing = await pool.query("SELECT id FROM employees WHERE email = $1", [adminEmail]);

  if (existing.rows.length > 0) {
    console.log("✅ Admin user already exists. Skipping.");
  } else {
    const hashedPassword = await bcrypt.hash("password", 12);
    await pool.query(
      `INSERT INTO employees (name, email, password, role, department) 
       VALUES ($1, $2, $3, $4, $5)`,
      ["Admin User", adminEmail, hashedPassword, "ADMIN", "Management"]
    );
    console.log("✅ Default admin created: admin@printflow.com / password");
  }

  // Sample employees
  const sampleEmployees = [
    { name: "Rajesh Kumar",  email: "rajesh@printflow.com",  role: "SUPERVISOR",        department: "Production", phone: "+91-9876543210" },
    { name: "Priya Sharma",  email: "priya@printflow.com",   role: "SALES_EXECUTIVE",   department: "Sales",      phone: "+91-9876543211" },
    { name: "Amit Patel",    email: "amit@printflow.com",    role: "MACHINE_OPERATOR",  department: "Production", phone: "+91-9876543212" },
    { name: "Sneha Desai",   email: "sneha@printflow.com",   role: "QC_TEAM",           department: "Quality",    phone: "+91-9876543213" },
    { name: "Vikram Singh",  email: "vikram@printflow.com",  role: "INVENTORY_MANAGER", department: "Warehouse",  phone: "+91-9876543214" },
    { name: "Neha Gupta",    email: "neha@printflow.com",    role: "FINANCE",           department: "Accounts",   phone: "+91-9876543215" },
    { name: "Suresh Reddy",  email: "suresh@printflow.com",  role: "DISPATCH",          department: "Logistics",  phone: "+91-9876543216" },
    { name: "Kavita Joshi",  email: "kavita@printflow.com",  role: "PACKAGING",         department: "Packaging",  phone: "+91-9876543217" },
    { name: "Ramesh Verma",  email: "ramesh@printflow.com",  role: "MACHINE_OPERATOR",  department: "Production", phone: "+91-9876543218" },
    { name: "Anita Mishra",  email: "anita@printflow.com",   role: "SALES_EXECUTIVE",   department: "Sales",      phone: "+91-9876543219" },
  ];

  const hashedPwd = await bcrypt.hash("password123", 12);

  for (const emp of sampleEmployees) {
    const exists = await pool.query("SELECT id FROM employees WHERE email = $1", [emp.email]);
    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO employees (name, email, phone, password, role, department)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [emp.name, emp.email, emp.phone, hashedPwd, emp.role, emp.department]
      );
      console.log(`  ✅ Created: ${emp.name} (${emp.role})`);
    } else {
      console.log(`  ⏭️  Skipped: ${emp.name} (already exists)`);
    }
  }

  console.log("\n🎉 Seeding complete!");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
