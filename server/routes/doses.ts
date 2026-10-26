import { Router, Response } from 'express';
import { db } from '../db.ts';
import { authRequired, AuthRequest } from '../middleware/auth.ts';
import { generateDosesForUser, markOverdueAsMissed, toDateStr } from '../utils/scheduleEngine.ts';

const router = Router();
router.use(authRequired);

const VALID_STATUSES = ['TAKEN', 'MISSED', 'SKIPPED', 'PENDING', 'SNOOZED'];

function withMedicine(rows: any[]) {
  const medStmt = db.prepare('SELECT id, name, type, dosage, foodInstruction FROM medicines WHERE id = ?');
  return rows.map((d) => ({ ...d, medicine: medStmt.get(d.medicineId) }));
}

// Today's doses
router.get('/today', (req: AuthRequest, res: Response) => {
  generateDosesForUser(req.userId!, 14);
  markOverdueAsMissed(req.userId!);

  const today = toDateStr(new Date());
  const rows = db.prepare(`
    SELECT d.*, m.name as medicineName, m.type as medicineType, m.dosage, m.foodInstruction
    FROM doses d JOIN medicines m ON m.id = d.medicineId
    WHERE d.userId = ? AND d.scheduledDate = ?
    ORDER BY d.scheduledTime ASC
  `).all(req.userId!, today);

  res.json({ date: today, doses: rows });
});

// History / Filtered list
router.get('/', (req: AuthRequest, res: Response) => {
  const { medicineId, status, from, to, limit = 100 } = req.query;

  let sql = `
    SELECT d.*, m.name as medicineName, m.type as medicineType, m.dosage, m.foodInstruction
    FROM doses d JOIN medicines m ON m.id = d.medicineId
    WHERE d.userId = ?
  `;
  const params: any[] = [req.userId];

  if (medicineId) {
    sql += ' AND d.medicineId = ?';
    params.push(medicineId);
  }
  if (status && VALID_STATUSES.includes(String(status))) {
    sql += ' AND d.status = ?';
    params.push(status);
  }
  if (from) {
    sql += ' AND d.scheduledDate >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND d.scheduledDate <= ?';
    params.push(to);
  }

  sql += ' ORDER BY d.scheduledDate DESC, d.scheduledTime DESC LIMIT ?';
  params.push(Number(limit) || 100);

  const rows = db.prepare(sql).all(...params);
  res.json({ doses: rows });
});

// Update dose status
router.put('/:id', (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const dose = db.prepare('SELECT * FROM doses WHERE id = ? AND userId = ?').get(req.params.id, req.userId) as any;
  if (!dose) return res.status(404).json({ error: 'Dose not found.' });

  const previousStatus = dose.status;
  const takenTime = status === 'TAKEN' ? new Date().toISOString() : null;

  db.prepare('UPDATE doses SET status = ?, takenTime = ? WHERE id = ?').run(status, takenTime, req.params.id);

  // Inventory adjustment: if changed to TAKEN, decrement 1; if reverting from TAKEN, increment 1
  if (previousStatus !== 'TAKEN' && status === 'TAKEN') {
    db.prepare('UPDATE inventory SET currentQuantity = MAX(0, currentQuantity - 1) WHERE medicineId = ?').run(dose.medicineId);
  } else if (previousStatus === 'TAKEN' && status !== 'TAKEN') {
    db.prepare('UPDATE inventory SET currentQuantity = currentQuantity + 1 WHERE medicineId = ?').run(dose.medicineId);
  }

  const updated = db.prepare(`
    SELECT d.*, m.name as medicineName, m.type as medicineType, m.dosage, m.foodInstruction
    FROM doses d JOIN medicines m ON m.id = d.medicineId
    WHERE d.id = ?
  `).get(req.params.id);

  res.json({ dose: updated });
});

// Snooze dose
router.post('/:id/snooze', (req: AuthRequest, res: Response) => {
  const minutes = Number(req.body.minutes) || 15;
  const dose = db.prepare('SELECT * FROM doses WHERE id = ? AND userId = ?').get(req.params.id, req.userId) as any;
  if (!dose) return res.status(404).json({ error: 'Dose not found.' });

  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  const newTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  db.prepare('UPDATE doses SET scheduledTime = ?, status = ? WHERE id = ?').run(newTime, 'SNOOZED', req.params.id);

  const updated = db.prepare('SELECT * FROM doses WHERE id = ?').get(req.params.id);
  res.json({ dose: updated, snoozedUntil: newTime });
});

// Calendar month aggregation
router.get('/calendar/:year/:month', (req: AuthRequest, res: Response) => {
  const { year, month } = req.params;
  const mm = String(month).padStart(2, '0');
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-31`;

  const rows = db.prepare(`
    SELECT scheduledDate, status, COUNT(*) as c
    FROM doses
    WHERE userId = ? AND scheduledDate BETWEEN ? AND ?
    GROUP BY scheduledDate, status
  `).all(req.userId!, start, end) as any[];

  const days: Record<string, { total: number; taken: number; missed: number; skipped: number; pending: number; snoozed: number; color: string }> = {};

  for (const r of rows) {
    if (!days[r.scheduledDate]) {
      days[r.scheduledDate] = { total: 0, taken: 0, missed: 0, skipped: 0, pending: 0, snoozed: 0, color: 'gray' };
    }
    const d = days[r.scheduledDate];
    d.total += r.c;
    if (r.status === 'TAKEN') d.taken += r.c;
    else if (r.status === 'MISSED') d.missed += r.c;
    else if (r.status === 'SKIPPED') d.skipped += r.c;
    else if (r.status === 'SNOOZED') d.snoozed += r.c;
    else d.pending += r.c;
  }

  const todayStr = toDateStr(new Date());

  for (const [dateStr, d] of Object.entries(days)) {
    if (dateStr > todayStr) {
      d.color = 'gray'; // future
    } else if (d.total > 0 && d.taken === d.total) {
      d.color = 'green'; // 100% adherence
    } else if (d.missed > 0 && d.taken === 0) {
      d.color = 'red'; // all missed
    } else if (d.missed > 0 || d.skipped > 0) {
      d.color = 'yellow'; // partial adherence
    } else if (d.pending > 0 && dateStr === todayStr) {
      d.color = d.taken > 0 ? 'yellow' : 'blue';
    } else {
      d.color = 'gray';
    }
  }

  res.json({ year: Number(year), month: Number(month), days });
});

export default router;
