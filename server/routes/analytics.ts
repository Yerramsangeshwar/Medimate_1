import { Router, Response } from 'express';
import { db } from '../db.ts';
import { authRequired, AuthRequest } from '../middleware/auth.ts';
import { toDateStr } from '../utils/scheduleEngine.ts';

const router = Router();
router.use(authRequired);

router.get('/', (req: AuthRequest, res: Response) => {
  const daysParam = Number(req.query.days) || 30;
  const today = toDateStr(new Date());

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysParam);
  const fromStr = toDateStr(fromDate);

  // 1. Daily trend
  const dailyRows = db.prepare(`
    SELECT scheduledDate,
      SUM(CASE WHEN status = 'TAKEN' THEN 1 ELSE 0 END) as taken,
      SUM(CASE WHEN status = 'MISSED' THEN 1 ELSE 0 END) as missed,
      SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) as skipped,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
      COUNT(*) as total
    FROM doses
    WHERE userId = ? AND scheduledDate BETWEEN ? AND ?
    GROUP BY scheduledDate
    ORDER BY scheduledDate ASC
  `).all(req.userId!, fromStr, today) as any[];

  const dailyTrend = dailyRows.map((r) => {
    const closedTotal = r.taken + r.missed + r.skipped;
    const rate = closedTotal > 0 ? Math.round((r.taken / closedTotal) * 100) : r.taken > 0 ? 100 : 0;
    return {
      date: r.scheduledDate,
      shortDate: r.scheduledDate.slice(5),
      taken: r.taken,
      missed: r.missed,
      skipped: r.skipped,
      pending: r.pending,
      total: r.total,
      adherenceRate: rate,
    };
  });

  // 2. Status distribution
  const totals = db.prepare(`
    SELECT status, COUNT(*) as c
    FROM doses
    WHERE userId = ? AND scheduledDate BETWEEN ? AND ?
    GROUP BY status
  `).all(req.userId!, fromStr, today) as any[];

  let totalTaken = 0, totalMissed = 0, totalSkipped = 0, totalPending = 0;
  for (const t of totals) {
    if (t.status === 'TAKEN') totalTaken += t.c;
    else if (t.status === 'MISSED') totalMissed += t.c;
    else if (t.status === 'SKIPPED') totalSkipped += t.c;
    else totalPending += t.c;
  }

  const overallDecided = totalTaken + totalMissed + totalSkipped;
  const overallRate = overallDecided > 0 ? Math.round((totalTaken / overallDecided) * 100) : 0;

  // 3. Time of day distribution
  const allDoses = db.prepare(`
    SELECT scheduledTime, status
    FROM doses
    WHERE userId = ? AND scheduledDate BETWEEN ? AND ?
  `).all(req.userId!, fromStr, today) as any[];

  const timeSlots = {
    Morning: { taken: 0, missed: 0, skipped: 0, total: 0 },
    Afternoon: { taken: 0, missed: 0, skipped: 0, total: 0 },
    Evening: { taken: 0, missed: 0, skipped: 0, total: 0 },
    Night: { taken: 0, missed: 0, skipped: 0, total: 0 },
  };

  for (const d of allDoses) {
    const hour = parseInt(d.scheduledTime?.slice(0, 2) || '9', 10);
    let slot: keyof typeof timeSlots = 'Morning';
    if (hour >= 6 && hour < 12) slot = 'Morning';
    else if (hour >= 12 && hour < 17) slot = 'Afternoon';
    else if (hour >= 17 && hour < 21) slot = 'Evening';
    else slot = 'Night';

    timeSlots[slot].total++;
    if (d.status === 'TAKEN') timeSlots[slot].taken++;
    else if (d.status === 'MISSED') timeSlots[slot].missed++;
    else if (d.status === 'SKIPPED') timeSlots[slot].skipped++;
  }

  const timeOfDayData = Object.entries(timeSlots).map(([slot, data]) => {
    const decided = data.taken + data.missed + data.skipped;
    return {
      slot,
      ...data,
      rate: decided > 0 ? Math.round((data.taken / decided) * 100) : 0,
    };
  });

  // 4. Per-medicine compliance
  const medCompliance = db.prepare(`
    SELECT m.name, m.dosage, m.type,
      SUM(CASE WHEN d.status = 'TAKEN' THEN 1 ELSE 0 END) as taken,
      SUM(CASE WHEN d.status = 'MISSED' THEN 1 ELSE 0 END) as missed,
      SUM(CASE WHEN d.status = 'SKIPPED' THEN 1 ELSE 0 END) as skipped,
      COUNT(d.id) as totalDoses
    FROM medicines m
    JOIN doses d ON d.medicineId = m.id
    WHERE m.userId = ? AND d.scheduledDate BETWEEN ? AND ?
    GROUP BY m.id
    ORDER BY taken DESC
  `).all(req.userId!, fromStr, today) as any[];

  const perMedicine = medCompliance.map((m) => {
    const decided = m.taken + m.missed + m.skipped;
    return {
      ...m,
      rate: decided > 0 ? Math.round((m.taken / decided) * 100) : 0,
    };
  });

  // 5. Streaks
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  for (let i = dailyTrend.length - 1; i >= 0; i--) {
    const day = dailyTrend[i];
    if (day.total > 0 && day.missed === 0 && day.taken > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  for (const day of dailyTrend) {
    if (day.total > 0 && day.missed === 0 && day.taken > 0) {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  res.json({
    rangeDays: daysParam,
    overallRate,
    counts: { taken: totalTaken, missed: totalMissed, skipped: totalSkipped, pending: totalPending },
    dailyTrend,
    timeOfDayData,
    perMedicine,
    currentStreak,
    bestStreak,
  });
});

export default router;
