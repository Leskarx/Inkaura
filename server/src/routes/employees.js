const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

// All employee routes require authentication + ADMIN role
router.use(authenticate, requireRole("ADMIN"));

/**
 * GET /api/employees
 * List employees with optional search and role/status filters.
 * Query params: search, role, status (active|inactive), page, limit
 */
router.get("/", async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = "WHERE 1=1";
    const params = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR phone ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (role) {
      whereClause += ` AND role = $${paramIdx}`;
      params.push(role);
      paramIdx++;
    }

    if (status === "active") {
      whereClause += " AND is_active = true";
    } else if (status === "inactive") {
      whereClause += " AND is_active = false";
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM employees ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT id, name, email, phone, role, department, is_active, created_at, updated_at
       FROM employees ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: dataResult.rows,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    console.error("List employees error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/**
 * GET /api/employees/stats
 * Role-wise employee counts for dashboard.
 */
router.get("/stats", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT role, COUNT(*) as count, 
             COUNT(*) FILTER (WHERE is_active = true) as active_count
      FROM employees
      GROUP BY role
      ORDER BY count DESC
    `);

    const totalResult = await pool.query(`
      SELECT COUNT(*) as total, 
             COUNT(*) FILTER (WHERE is_active = true) as active
      FROM employees
    `);

    res.json({
      success: true,
      byRole: result.rows,
      total: parseInt(totalResult.rows[0].total, 10),
      active: parseInt(totalResult.rows[0].active, 10),
    });
  } catch (err) {
    console.error("Employee stats error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/**
 * GET /api/employees/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, role, department, is_active, created_at, updated_at
       FROM employees WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Get employee error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/**
 * POST /api/employees
 * Create a new employee. Password is auto-hashed.
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, password, role, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required." });
    }

    // Check duplicate email
    const existing = await pool.query("SELECT id FROM employees WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "An employee with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO employees (name, email, phone, password, role, department)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, role, department, is_active, created_at`,
      [name, email, phone || null, hashedPassword, role || "OPERATOR", department || null]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: "Employee created successfully." });
  } catch (err) {
    console.error("Create employee error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/**
 * PUT /api/employees/:id
 * Update an existing employee. Password updated only if provided.
 */
router.put("/:id", async (req, res) => {
  try {
    const { name, email, phone, password, role, department, is_active } = req.body;

    // Check exists
    const existing = await pool.query("SELECT * FROM employees WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    // Check email uniqueness if changed
    if (email && email !== existing.rows[0].email) {
      const dup = await pool.query("SELECT id FROM employees WHERE email = $1 AND id != $2", [email, req.params.id]);
      if (dup.rows.length > 0) {
        return res.status(409).json({ success: false, message: "Another employee with this email already exists." });
      }
    }

    // Build dynamic SET clause
    const sets = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx}`); params.push(name); idx++; }
    if (email !== undefined) { sets.push(`email = $${idx}`); params.push(email); idx++; }
    if (phone !== undefined) { sets.push(`phone = $${idx}`); params.push(phone || null); idx++; }
    if (role !== undefined) { sets.push(`role = $${idx}`); params.push(role); idx++; }
    if (department !== undefined) { sets.push(`department = $${idx}`); params.push(department || null); idx++; }
    if (is_active !== undefined) { sets.push(`is_active = $${idx}`); params.push(is_active); idx++; }
    if (password) {
      const hashed = await bcrypt.hash(password, 12);
      sets.push(`password = $${idx}`); params.push(hashed); idx++;
    }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update." });
    }

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE employees SET ${sets.join(", ")} WHERE id = $${idx}
       RETURNING id, name, email, phone, role, department, is_active, created_at, updated_at`,
      params
    );

    res.json({ success: true, data: result.rows[0], message: "Employee updated successfully." });
  } catch (err) {
    console.error("Update employee error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/**
 * DELETE /api/employees/:id
 * Soft delete — sets is_active = false.
 */
router.delete("/:id", async (req, res) => {
  try {
    const existing = await pool.query("SELECT id FROM employees WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    await pool.query("UPDATE employees SET is_active = false WHERE id = $1", [req.params.id]);

    res.json({ success: true, message: "Employee deactivated successfully." });
  } catch (err) {
    console.error("Delete employee error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

module.exports = router;
