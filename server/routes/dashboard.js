const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { generateDosesForUser, markOverdueAsMissed, toDateStr } = require("../utils/scheduleEngine");

const router = express.Router();
router.use(authRequired);

router.get("/", (req, res) => {
  generateDosesForUser(req.userId, 14);
  markOverdueAsMissed(req.userId);

  const today = toDateStr(new Date());

  const activeMedicines = db.prepare(
    "SELECT COUNT(*) as c FROM medicines WHERE userId = ? AND active = 1"
  ).get(req.userId).c;

  const todayDoses = db.prepare(
    "SELECT status, COUNT(*) as c FROM doses WHERE userId = ? AND scheduledDate = ? GROUP BY status"
  ).all(req.userId, today);

  const stats = { total: 0, taken: 0, missed: 0, skipped: 0, pending: 0 };
  for (const row of todayDoses) {
    stats.total += row.c;
    if (row.status === "TAKEN") stats.taken += row.c;
    else if (row.status === "MISSED") stats.missed += row.c;
    else if (row.status === "SKIPPED") stats.skipped += row.c;
    else stats.pending += row.c;
  }
  const progressPct = stats.total ? Math.round((stats.taken / stats.total) * 100) : 0;

  const lowStock = db.prepare(`
    SELECT m.id, m.name, i.currentQuantity, i.minimumQuantity
    FROM inventory i JOIN medicines m ON m.id = i.medicineId
    WHERE m.userId = ? AND m.active = 1 AND i.currentQuantity <= i.minimumQuantity
  `).all(req.userId);

  // 30-day adherence
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fromStr = toDateStr(from);
  const adherenceRows = db.prepare(`
    SELECT status, COUNT(*) as c FROM doses
    WHERE userId = ? AND scheduledDate BETWEEN ? AND ? AND status != 'PENDING'
    GROUP BY status
  `).all(req.userId, fromStr, today);
  let adhTotal = 0, adhTaken = 0;
  for (const r of adherenceRows) {
    adhTotal += r.c;
    if (r.status === "TAKEN") adhTaken += r.c;
  }
  const adherencePct = adhTotal ? Math.round((adhTaken / adhTotal) * 100) : null;

  const todayList = db.prepare(`
    SELECT d.*, m.name as medicineName, m.type as medicineType, m.dosage
    FROM doses d JOIN medicines m ON m.id = d.medicineId
    WHERE d.userId = ? AND d.scheduledDate = ?
    ORDER BY d.scheduledTime ASC
  `).all(req.userId, today);

  res.json({
    date: today,
    activeMedicines,
    todayStats: { ...stats, progressPct },
    lowStock,
    adherence30d: adherencePct,
    todayDoses: todayList,
  });
});

module.exports = router;
