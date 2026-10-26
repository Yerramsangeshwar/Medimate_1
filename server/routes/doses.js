const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { generateDosesForUser, markOverdueAsMissed, toDateStr } = require("../utils/scheduleEngine");

const router = express.Router();
router.use(authRequired);

const VALID_STATUSES = ["TAKEN", "MISSED", "SKIPPED", "PENDING", "SNOOZED"];

function withMedicine(rows) {
  const medStmt = db.prepare("SELECT id, name, type, dosage, foodInstruction FROM medicines WHERE id = ?");
  return rows.map((d) => ({ ...d, medicine: medStmt.get(d.medicineId) }));
}

// ---------- Today's doses (also self-heals: regenerates + marks overdue) ----------
router.get("/today", (req, res) => {
  generateDosesForUser(req.userId, 14);
  markOverdueAsMissed(req.userId);

  const today = toDateStr(new Date());
  const rows = db.prepare(`
    SELECT * FROM doses WHERE userId = ? AND scheduledDate = ? ORDER BY scheduledTime ASC
  `).all(req.userId, today);

  res.json({ date: today, doses: withMedicine(rows) });
});

// ---------- History with optional filters ----------
router.get("/", (req, res) => {
  const { medicineId, from, to, status } = req.query;
  let sql = "SELECT * FROM doses WHERE userId = ?";
  const params = [req.userId];

  if (medicineId) { sql += " AND medicineId = ?"; params.push(medicineId); }
  if (from) { sql += " AND scheduledDate >= ?"; params.push(from); }
  if (to) { sql += " AND scheduledDate <= ?"; params.push(to); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY scheduledDate DESC, scheduledTime DESC LIMIT 500";

  const rows = db.prepare(sql).all(...params);
  res.json({ doses: withMedicine(rows) });
});

// ---------- Calendar summary: one row per day with a color status ----------
router.get("/calendar/:year/:month", (req, res) => {
  generateDosesForUser(req.userId, 14);
  const { year, month } = req.params; // month = 1-12
  const mm = String(month).padStart(2, "0");
  const from = `${year}-${mm}-01`;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  const to = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;

  const rows = db.prepare(`
    SELECT scheduledDate, status, COUNT(*) as count
    FROM doses WHERE userId = ? AND scheduledDate BETWEEN ? AND ?
    GROUP BY scheduledDate, status
  `).all(req.userId, from, to);

  const byDate = {};
  for (const r of rows) {
    byDate[r.scheduledDate] = byDate[r.scheduledDate] || { total: 0, taken: 0, missed: 0, skipped: 0, pending: 0 };
    byDate[r.scheduledDate].total += r.count;
    if (r.status === "TAKEN") byDate[r.scheduledDate].taken += r.count;
    if (r.status === "MISSED") byDate[r.scheduledDate].missed += r.count;
    if (r.status === "SKIPPED") byDate[r.scheduledDate].skipped += r.count;
    if (r.status === "PENDING" || r.status === "SNOOZED") byDate[r.scheduledDate].pending += r.count;
  }

  const days = Object.entries(byDate).map(([date, stats]) => {
    let color = "gray";
    if (stats.total > 0) {
      if (stats.missed > 0) color = "red";
      else if (stats.pending > 0) color = "yellow";
      else color = "green";
    }
    return { date, ...stats, color };
  });

  res.json({ year: Number(year), month: Number(month), days });
});

// ---------- Update a dose's status ----------
router.put("/:id", (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
  }
  const dose = db.prepare("SELECT * FROM doses WHERE id = ? AND userId = ?").get(req.params.id, req.userId);
  if (!dose) return res.status(404).json({ error: "Dose not found." });

  const takenTime = status === "TAKEN" ? new Date().toISOString() : null;
  db.prepare("UPDATE doses SET status = ?, takenTime = ? WHERE id = ?").run(status, takenTime, req.params.id);

  // Decrement inventory when marked as taken.
  if (status === "TAKEN") {
    db.prepare(`
      UPDATE inventory SET currentQuantity = MAX(currentQuantity - 1, 0)
      WHERE medicineId = ?
    `).run(dose.medicineId);
  }

  const updated = db.prepare("SELECT * FROM doses WHERE id = ?").get(req.params.id);
  res.json({ dose: updated });
});

// ---------- Snooze (push scheduled time by N minutes, default 10) ----------
router.post("/:id/snooze", (req, res) => {
  const minutes = Number(req.body.minutes) || 10;
  const dose = db.prepare("SELECT * FROM doses WHERE id = ? AND userId = ?").get(req.params.id, req.userId);
  if (!dose) return res.status(404).json({ error: "Dose not found." });

  const dt = new Date(`${dose.scheduledDate}T${dose.scheduledTime}:00`);
  dt.setMinutes(dt.getMinutes() + minutes);
  const newTime = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;

  db.prepare("UPDATE doses SET scheduledTime = ?, status = 'SNOOZED' WHERE id = ?").run(newTime, req.params.id);
  const updated = db.prepare("SELECT * FROM doses WHERE id = ?").get(req.params.id);
  res.json({ dose: updated });
});

module.exports = router;
