const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "printflow-erp-secret-key-2026";

/**
 * Verify JWT token from Authorization header.
 * Attaches decoded user payload to req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

/**
 * Restrict access to specific roles.
 * Usage: requireRole("ADMIN", "SUPERVISOR")
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Insufficient permissions." });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, JWT_SECRET };
