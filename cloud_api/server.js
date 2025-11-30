import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// DB availability and in-memory fallback
let DB_AVAILABLE = true;
const INMEM_TAGS = [];
const INMEM_DATA = [];
const INMEM_HISTORY = [];

// ✅ Root Test
app.get("/", (req, res) => {
  res.send("Cloud API Running ✅");
});

// ✅ Get all PLC data
app.get("/api/plc/data", async (req, res) => {
  try {
    if (!DB_AVAILABLE) {
      // Merge tag metadata with last known in-memory values
      const tagMap = INMEM_TAGS.reduce((acc, t) => { acc[t.tag] = t; return acc; }, {});
      const lastValues = INMEM_DATA.reduce((acc, d) => { acc[d.tag] = d; return acc; }, {});
      const merged = (INMEM_TAGS.length > 0 ? INMEM_TAGS : Object.keys(lastValues).map(tag => ({ tag }))).map(t => ({
        id: lastValues[t.tag]?.id || null,
        tag: t.tag,
        value: lastValues[t.tag]?.value || null,
        updated_at: lastValues[t.tag]?.updated_at || null,
        address: t.address,
        type: t.type,
        function: t.function,
        label: t.label,
        unit: t.unit || null
      }));
      return res.json(merged.slice(0,100));
    }
    const [rows] = await pool.query(
      `SELECT t.tag, p.id, p.value, p.updated_at, t.address, t.type, t.function, t.label, t.unit
       FROM plc_tags t
       LEFT JOIN plc_data p ON p.tag = t.tag
       ORDER BY p.updated_at DESC LIMIT 100`
    );
    console.log(`📊 Fetched ${rows.length} records`);
    res.json(rows);
  } catch (err) {
    console.error("❌ Database fetch error:", err.message);
    res.status(500).json({ error: "Database fetch failed", details: err.message });
  }
});

// GET history for a tag
app.get('/api/plc/history', async (req, res) => {
  const { tag, limit } = req.query;
  if (!tag) return res.status(400).json({ error: 'Missing tag parameter' });
  const max = Number(limit) || 100;
  try {
    if (!DB_AVAILABLE) {
      return res.json(INMEM_HISTORY.filter(h => h.tag === tag).slice().reverse().slice(0, max));
    }
    const [rows] = await pool.query('SELECT id, tag, value, status, captured_at FROM plc_data_history WHERE tag = ? ORDER BY id DESC LIMIT ?', [tag, max]);
    res.json(rows);
  } catch (err) {
    console.error('❌ Failed to fetch history:', err.message);
    res.status(500).json({ error: 'Failed to fetch history', details: err.message });
  }
});

// ✅ Update or Insert Data (from PLC or Local Bridge)
app.post("/api/plc/update", async (req, res) => {
  const { tag, value } = req.body;
  
  if (!tag || value === undefined) {
    return res.status(400).json({ error: "Missing tag or value" });
  }

  try {
    if (!DB_AVAILABLE) {
      // Store in-memory
      const record = { id: INMEM_DATA.length + 1, tag, value, updated_at: new Date().toISOString() };
      const existingIdx = INMEM_DATA.findIndex(d => d.tag === tag);
      if (existingIdx >= 0) INMEM_DATA[existingIdx] = record; else INMEM_DATA.push(record);
      INMEM_HISTORY.push({ id: INMEM_HISTORY.length + 1, tag_id: null, tag, value, captured_at: new Date().toISOString() });
      console.log(`✅ In-memory upsert & history for ${tag} = ${value}`);
      return res.json({ success: true, tag, value, inmem: true });
    }
    // Find a matching tag in plc_tags (optional) to get ID and metadata
    const [tagRows] = await pool.query(
      "SELECT id FROM plc_tags WHERE tag = ? LIMIT 1",
      [tag]
    );
    const tagId = tagRows.length > 0 ? tagRows[0].id : null;

    // Upsert into plc_data (last-known state)
    const [existing] = await pool.query("SELECT id FROM plc_data WHERE tag = ? LIMIT 1", [tag]);
    if (existing.length > 0) {
      await pool.query("UPDATE plc_data SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE tag = ?", [value, tag]);
    } else {
      await pool.query("INSERT INTO plc_data (tag, value, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", [tag, value]);
    }

    // Insert to history table (timestamped)
    await pool.query(
      "INSERT INTO plc_data_history (tag_id, tag, value, captured_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
      [tagId, tag, value]
    );

    console.log(`✅ Upserted & history inserted for tag: ${tag} = ${value} (tagId=${tagId})`);
    res.json({ success: true, tag, value, tagId });
  } catch (err) {
    console.error("❌ Database error:", err.message);
    res.status(500).json({ error: "Database update failed", details: err.message });
  }
});

// ✅ Update via Dashboard
app.put("/api/plc/edit", async (req, res) => {
  const { tag, value } = req.body;
  if (!tag || value === undefined)
    return res.status(400).json({ error: "Missing tag or value" });
  try {
    if (!DB_AVAILABLE) {
      const record = { id: INMEM_DATA.length + 1, tag, value, updated_at: new Date().toISOString() };
      const existingIdx = INMEM_DATA.findIndex(d => d.tag === tag);
      if (existingIdx >= 0) INMEM_DATA[existingIdx] = record; else INMEM_DATA.push(record);
      INMEM_HISTORY.push({ id: INMEM_HISTORY.length + 1, tag_id: null, tag, value, captured_at: new Date().toISOString() });
    } else {
      await pool.query(
        "UPDATE plc_data SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE tag = ?",
        [value, tag]
      );
      // Also insert into history (find tag id if present)
      const [tagRows] = await pool.query('SELECT id FROM plc_tags WHERE tag = ? LIMIT 1', [tag]);
      const tagId = tagRows.length > 0 ? tagRows[0].id : null;
      await pool.query('INSERT INTO plc_data_history (tag_id, tag, value, captured_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [tagId, tag, value]);
    }
    res.json({ success: true, message: "Value updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

// ------------------- Tag management (CRUD) -------------------
// GET tags
app.get('/api/plc/tags', async (req, res) => {
  try {
    if (!DB_AVAILABLE) {
      return res.json(INMEM_TAGS.slice().sort((a,b)=>a.tag.localeCompare(b.tag)));
    }
    const [rows] = await pool.query('SELECT id, tag, address, type, `function`, label, unit FROM plc_tags ORDER BY tag');
    res.json(rows);
  } catch (err) {
    console.error('❌ Failed to fetch tags:', err.message);
    res.status(500).json({ error: 'Failed to fetch tags', details: err.message });
  }
});

// CREATE tag
app.post('/api/plc/tags', async (req, res) => {
  const { tag, address, type, function: func, label, unit } = req.body;
  if (!tag || address === undefined || !type || !func) {
    return res.status(400).json({ error: 'Missing tag/address/type/function' });
  }
  try {
    if (!DB_AVAILABLE) {
      const id = INMEM_TAGS.length + 1;
      INMEM_TAGS.push({ id, tag, address, type, function: func, label: label || null, unit: unit || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return res.json({ success: true, id });
    }
    const [result] = await pool.query(
      'INSERT INTO plc_tags (tag, address, type, `function`, label, unit) VALUES (?, ?, ?, ?, ?, ?)',
      [tag, address, type, func, label || null, unit || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('❌ Failed to create tag:', err.message);
    res.status(500).json({ error: 'Failed to create tag', details: err.message });
  }
});

// UPDATE tag
app.put('/api/plc/tags/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { tag, address, type, function: func, label, unit } = req.body;
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    if (!DB_AVAILABLE) {
      const idx = INMEM_TAGS.findIndex(t => t.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Tag not found' });
      INMEM_TAGS[idx] = { ...INMEM_TAGS[idx], tag, address, type, function: func, label: label || null, unit: unit || INMEM_TAGS[idx].unit || null, updated_at: new Date().toISOString() };
      return res.json({ success: true });
    }
    await pool.query(
      'UPDATE plc_tags SET tag = ?, address = ?, type = ?, `function` = ?, label = ?, unit = ? WHERE id = ?',
      [tag, address, type, func, label || null, unit || null, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed to update tag:', err.message);
    res.status(500).json({ error: 'Failed to update tag', details: err.message });
  }
});

// DELETE tag
app.delete('/api/plc/tags/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    if (!DB_AVAILABLE) {
      const idx = INMEM_TAGS.findIndex(t => t.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      INMEM_TAGS.splice(idx, 1);
      return res.json({ success: true });
    }
    await pool.query('DELETE FROM plc_tags WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed to delete tag:', err.message);
    res.status(500).json({ error: 'Failed to delete tag', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
// Run migrations on startup (simple approach: create tables if missing)
async function runMigrations() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plc_tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tag VARCHAR(100) NOT NULL UNIQUE,
        address INT NOT NULL,
        type VARCHAR(20) NOT NULL,
        \`function\` VARCHAR(20) NOT NULL,
        label VARCHAR(255) DEFAULT NULL,
        unit VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plc_data_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tag_id INT NULL,
        tag VARCHAR(100) NOT NULL,
        value VARCHAR(255) NULL,
        status VARCHAR(50) NULL,
        captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tag_id) REFERENCES plc_tags(id) ON DELETE SET NULL
      );
    `);
    console.log('✅ Migrations applied (plc_tags, plc_data_history)');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    // Set DB_AVAILABLE to false so endpoints fall back to in-memory storage
    DB_AVAILABLE = false;
  }
}

runMigrations().then(() => {
  const tryListen = (port, attemptsLeft = 5) => {
    const server = app.listen(port, () => console.log(`🌐 Cloud API running on port ${port}`));
    server.on('error', (err) => {
      if (attemptsLeft <= 0) {
        console.error('❌ Failed to bind to port:', err.message);
        process.exit(1);
      }
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${port} in use, trying ${port + 1}...`);
        tryListen(port + 1, attemptsLeft - 1);
      } else {
        console.error('❌ Server error:', err.message);
        process.exit(1);
      }
    });
  };
  tryListen(Number(PORT));
});
