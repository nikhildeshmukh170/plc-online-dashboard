import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Database Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.connect(err => {
  if (err) {
    console.error("Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to database");
  }
});

// Create table if not exists
db.query(
  `CREATE TABLE IF NOT EXISTS plc_values (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tag VARCHAR(255),
    value VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`
);

// Route 1: PLC → Cloud
app.post("/api/plc-upload", (req, res) => {
  const { tag, value } = req.body;
  if (!tag) return res.status(400).json({ error: "Missing tag" });

  const query = "INSERT INTO plc_values (tag, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value=?";
  db.query(query, [tag, value, value], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "DB Error" });
    }
    res.json({ message: "Data uploaded successfully" });
  });
});

// Route 2: Dashboard → Cloud
app.get("/api/plc-data", (req, res) => {
  db.query("SELECT * FROM plc_values", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Route 3: Dashboard → Update tag value (reflect back via bridge later)
app.post("/api/update-value", (req, res) => {
  const { tag, value } = req.body;
  if (!tag) return res.status(400).json({ error: "Missing tag" });

  const query = "UPDATE plc_values SET value=? WHERE tag=?";
  db.query(query, [value, tag], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Value updated successfully" });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🌍 Cloud API running on port ${PORT}`));
