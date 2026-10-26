import { Router, Response } from 'express';
import { db } from '../db.ts';
import { authRequired, AuthRequest } from '../middleware/auth.ts';
import { generateDosesForUser, markOverdueAsMissed, toDateStr } from '../utils/scheduleEngine.ts';

const router = Router();
router.use(authRequired);

router.get('/', (req: AuthRequest, res: Response) => {
  generateDosesForUser(req.userId!, 14);
  markOverdueAsMissed(req.userId!);

  const today = toDateStr(new Date());

  const activeMedicines = (
    db.prepare('SELECT COUNT(*) as c FROM medicines WHERE userId = ? AND active = 1').get(req.userId!) as any
  ).c;

  const todayDoses = db.prepare(`
    SELECT status, COUNT(*) as c FROM doses WHERE userId = ? AND scheduledDate = ? GROUP BY status
  `).all(req.userId!, today) as any[];

  const stats = { total: 0, taken: 0, missed: 0, skipped: 0, pending: 0, snoozed: 0 };
  for (const row of todayDoses) {
    stats.total += row.c;
    if (row.status === 'TAKEN') stats.taken += row.c;
    else if (row.status === 'MISSED') stats.missed += row.c;
    else if (row.status === 'SKIPPED') stats.skipped += row.c;
    else if (row.status === 'SNOOZED') stats.snoozed += row.c;
    else stats.pending += row.c;
  }
  const progressPct = stats.total ? Math.round((stats.taken / stats.total) * 100) : 0;

  const lowStock = db.prepare(`
    SELECT m.id, m.name, m.dosage, m.type, i.currentQuantity, i.minimumQuantity
    FROM inventory i JOIN medicines m ON m.id = i.medicineId
    WHERE m.userId = ? AND m.active = 1 AND i.currentQuantity <= i.minimumQuantity
  `).all(req.userId!);

  // 30-day adherence
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fromStr = toDateStr(from);
  const adherenceRows = db.prepare(`
    SELECT status, COUNT(*) as c FROM doses
    WHERE userId = ? AND scheduledDate BETWEEN ? AND ? AND status != 'PENDING'
    GROUP BY status
  `).all(req.userId!, fromStr, today) as any[];

  let adhTotal = 0;
  let adhTaken = 0;
  for (const r of adherenceRows) {
    adhTotal += r.c;
    if (r.status === 'TAKEN') adhTaken += r.c;
  }
  const adherencePct = adhTotal ? Math.round((adhTaken / adhTotal) * 100) : null;

  // Calculate current adherence streak
  const pastDays = db.prepare(`
    SELECT scheduledDate,
      SUM(CASE WHEN status = 'TAKEN' THEN 1 ELSE 0 END) as taken,
      SUM(CASE WHEN status = 'MISSED' THEN 1 ELSE 0 END) as missed,
      COUNT(*) as total
    FROM doses
    WHERE userId = ? AND scheduledDate < ?
    GROUP BY scheduledDate
    ORDER BY scheduledDate DESC
    LIMIT 30
  `).all(req.userId!, today) as any[];

  let streakDays = 0;
  for (const day of pastDays) {
    if (day.total > 0 && day.missed === 0 && day.taken > 0) {
      streakDays++;
    } else {
      break;
    }
  }

  // Today's list with full details
  const todayList = db.prepare(`
    SELECT d.*, m.name as medicineName, m.type as medicineType, m.dosage, m.foodInstruction, m.notes
    FROM doses d JOIN medicines m ON m.id = d.medicineId
    WHERE d.userId = ? AND d.scheduledDate = ?
    ORDER BY d.scheduledTime ASC
  `).all(req.userId!, today);

  // User profile emergency contact info
  const user = db.prepare('SELECT name, emergencyContact, phone FROM users WHERE id = ?').get(req.userId!) as any;

  res.json({
    date: today,
    activeMedicines,
    todayStats: { ...stats, progressPct },
    lowStock,
    adherence30d: adherencePct,
    streakDays,
    emergencyContact: user?.emergencyContact || null,
    todayDoses: todayList,
  });
});

export default router;
