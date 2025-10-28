import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// ✅ Root Test
app.get("/", (req, res) => {
  res.send("Cloud API Running ✅");
});

// ✅ Get all PLC data
app.get("/api/plc/data", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM plc_data ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database fetch failed" });
  }
});

// ✅ Update or Insert Data (from PLC or Local Bridge)
app.post("/api/plc/update", async (req, res) => {
  const { tag, value } = req.body;
  if (!tag || value === undefined)
    return res.status(400).json({ error: "Missing tag or value" });

  try {
    // Check if tag exists
    const [existing] = await pool.query("SELECT * FROM plc_data WHERE tag = ?", [tag]);

    if (existing.length > 0) {
      // Update existing record
      await pool.query(
        "UPDATE plc_data SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE tag = ?",
        [value, tag]
      );
    } else {
      // Insert new record
      await pool.query("INSERT INTO plc_data (tag, value) VALUES (?, ?)", [tag, value]);
    }

    res.json({ success: true, tag, value });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database update failed" });
  }
});

// ✅ Update via Dashboard
app.put("/api/plc/edit", async (req, res) => {
  const { tag, value } = req.body;
  if (!tag || value === undefined)
    return res.status(400).json({ error: "Missing tag or value" });

  try {
    await pool.query(
      "UPDATE plc_data SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE tag = ?",
      [value, tag]
    );
    res.json({ success: true, message: "Value updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Cloud API running on port ${PORT}`));
