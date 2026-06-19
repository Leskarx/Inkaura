const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/auth/login
 * Validate email + password, return JWT + user info.
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const result = await pool.query("SELECT * FROM employees WHERE email = $1", [email]);
    const employee = result.rows[0];

    if (!employee) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (!employee.is_active) {
      return res.status(403).json({ success: false, message: "Account is deactivated. Contact admin." });
    }

    const validPassword = await bcrypt.compare(password, employee.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const token = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role, name: employee.name },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

module.exports = router;
