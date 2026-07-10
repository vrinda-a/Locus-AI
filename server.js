/**
 * Locus AI — Express persistence API
 * Routes: GET/POST /api/sites, PUT/DELETE /api/sites/:id
 *
 * Setup:
 *   npm init -y && npm i express pg cors
 *   createdb locus && psql -d locus -f schema.sql
 *   DATABASE_URL=postgres://localhost/locus node server.js
 *
 * Then point the client at it by adding, before the app <script> in
 * locus-ai.html:  <script>window.LOCUS_API_BASE = "http://localhost:3001";</script>
 */
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://localhost/locus",
});

const app = express();
app.use(cors());
app.use(express.json());

const COLS =
  "id, user_id, site_name, latitude, longitude, site_type, status, feasibility_score, user_notes, saved_at";

// Hydrate the Right Panel dashboard
app.get("/api/sites", async (req, res) => {
  try {
    const userId = Number(req.query.userId) || 1;
    const { rows } = await pool.query(
      `SELECT ${COLS} FROM saved_locations WHERE user_id = $1 ORDER BY saved_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save a newly scored coordinate + notes payload
app.post("/api/sites", async (req, res) => {
  try {
    const b = req.body;
    if (!b.site_name || b.latitude == null || b.longitude == null)
      return res.status(400).json({ error: "site_name, latitude, longitude are required" });
    const { rows } = await pool.query(
      `INSERT INTO saved_locations
         (user_id, site_name, latitude, longitude, site_type, status, feasibility_score, user_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${COLS}`,
      [
        b.user_id || 1, b.site_name, b.latitude, b.longitude,
        b.site_type || null, b.status || "Prospect",
        b.feasibility_score ?? null, b.user_notes || "",
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update documentation / status / assessment for one record
app.put("/api/sites/:id", async (req, res) => {
  try {
    const allowed = ["site_name", "site_type", "status", "feasibility_score", "user_notes", "latitude", "longitude"];
    const sets = [], vals = [];
    for (const k of allowed)
      if (req.body[k] !== undefined) { vals.push(req.body[k]); sets.push(`${k} = $${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: "no updatable fields supplied" });
    vals.push(Number(req.params.id));
    const { rows } = await pool.query(
      `UPDATE saved_locations SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING ${COLS}`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: "site not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Purge a saved site from the registry
app.delete("/api/sites/:id", async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM saved_locations WHERE id = $1", [Number(req.params.id)]);
    if (!r.rowCount) return res.status(404).json({ error: "site not found" });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Locus API listening on :${PORT}`));
