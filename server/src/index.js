const express = require("express");
const cors = require("cors");
require("dotenv").config();

const initDatabase = require("./config/init-db");
const authRoutes = require("./routes/auth");
const employeeRoutes = require("./routes/employees");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Inkaura ERP API Running",
    });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);

const PORT = process.env.PORT || 5000;

// Initialize DB tables then start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });