import { Router, Response } from 'express';
import { db } from '../db.ts';
import { authRequired, AuthRequest } from '../middleware/auth.ts';
import { toDateStr } from '../utils/scheduleEngine.ts';

const router = Router();
router.use(authRequired);

router.get('/clinical', (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT id, name, email, phone, age, gender, bloodGroup, emergencyContact FROM users WHERE id = ?').get(req.userId!) as any;
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const today = toDateStr(new Date());
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const fromStr = toDateStr(fromDate);

  // Active medicines
  const medicines = db.prepare(`
    SELECT m.*, i.currentQuantity, i.minimumQuantity
    FROM medicines m
    LEFT JOIN inventory i ON i.medicineId = m.id
    WHERE m.userId = ? AND m.active = 1
    ORDER BY m.name ASC
  `).all(req.userId!) as any[];

  const formattedMeds = medicines.map((m) => ({
    id: m.id,
    name: m.name,
    dosage: m.dosage,
    type: m.type,
    frequency: m.frequency,
    times: JSON.parse(m.times || '[]'),
    foodInstruction: m.foodInstruction,
    doctorName: m.doctorName,
    notes: m.notes,
    currentQuantity: m.currentQuantity ?? m.quantity,
    status: (m.currentQuantity ?? m.quantity) <= (m.minimumQuantity ?? 5) ? 'Low Stock' : 'Adequate',
  }));

  // Adherence numbers
  const doseStats = db.prepare(`
    SELECT status, COUNT(*) as c
    FROM doses
    WHERE userId = ? AND scheduledDate BETWEEN ? AND ?
    GROUP BY status
  `).all(req.userId!, fromStr, today) as any[];

  let taken = 0, missed = 0, skipped = 0, pending = 0;
  for (const s of doseStats) {
    if (s.status === 'TAKEN') taken += s.c;
    else if (s.status === 'MISSED') missed += s.c;
    else if (s.status === 'SKIPPED') skipped += s.c;
    else pending += s.c;
  }

  const decided = taken + missed + skipped;
  const adherenceRate = decided > 0 ? Math.round((taken / decided) * 100) : 0;

  // Recent missed doses
  const missedDoses = db.prepare(`
    SELECT d.scheduledDate, d.scheduledTime, m.name as medicineName, m.dosage
    FROM doses d JOIN medicines m ON m.id = d.medicineId
    WHERE d.userId = ? AND d.scheduledDate BETWEEN ? AND ? AND d.status = 'MISSED'
    ORDER BY d.scheduledDate DESC, d.scheduledTime DESC
    LIMIT 20
  `).all(req.userId!, fromStr, today);

  res.json({
    reportDate: today,
    dateRange: { from: fromStr, to: today },
    patient: user,
    adherence: {
      rate: adherenceRate,
      taken,
      missed,
      skipped,
      pending,
      total: decided + pending,
    },
    medicines: formattedMeds,
    missedDoses,
    disclaimer: 'MediMate is a patient medication-adherence monitoring platform. This report summarizes logged doses for informational review during clinical consultation. It does not constitute medical diagnosis or advice.',
  });
});

export default router;
