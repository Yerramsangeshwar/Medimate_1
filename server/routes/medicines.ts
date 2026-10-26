import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db.ts';
import { authRequired, AuthRequest } from '../middleware/auth.ts';
import { generateDosesForMedicine, toDateStr } from '../utils/scheduleEngine.ts';

const router = Router();
router.use(authRequired);

const MEDICINE_TYPES = ['tablet', 'capsule', 'syrup', 'injection', 'drops', 'cream', 'inhaler', 'powder', 'other'];

function serialize(med: any) {
  if (!med) return null;
  return {
    ...med,
    times: JSON.parse(med.times || '[]'),
    daysOfWeek: med.daysOfWeek ? JSON.parse(med.daysOfWeek) : null,
    active: !!med.active,
  };
}

function validate(body: any) {
  const errors: string[] = [];
  if (!body.name || !body.name.trim()) errors.push('Medicine name is required.');
  if (body.type && !MEDICINE_TYPES.includes(body.type)) errors.push('Invalid medicine type.');
  if (!Array.isArray(body.times) || body.times.length === 0) errors.push('At least one dose time is required.');
  if (!body.startDate) errors.push('Start date is required.');
  return errors;
}

// List all medicines
router.get('/', (req: AuthRequest, res: Response) => {
  const { familyMemberId } = req.query;
  let rows: any[];
  if (familyMemberId === 'self') {
    rows = db.prepare('SELECT * FROM medicines WHERE userId = ? AND familyMemberId IS NULL ORDER BY name ASC').all(req.userId);
  } else if (familyMemberId) {
    rows = db.prepare('SELECT * FROM medicines WHERE userId = ? AND familyMemberId = ? ORDER BY name ASC').all(req.userId, familyMemberId);
  } else {
    rows = db.prepare('SELECT * FROM medicines WHERE userId = ? ORDER BY name ASC').all(req.userId);
  }

  // Attach inventory quantity
  const invMap = new Map();
  const invRows = db.prepare(`
    SELECT i.*, m.name FROM inventory i JOIN medicines m ON m.id = i.medicineId WHERE m.userId = ?
  `).all(req.userId);
  for (const inv of invRows as any[]) invMap.set(inv.medicineId, inv);

  const result = rows.map((r) => {
    const s = serialize(r);
    return { ...s, inventory: invMap.get(r.id) || null };
  });

  res.json({ medicines: result });
});

// Get single medicine
router.get('/:id', (req: AuthRequest, res: Response) => {
  const med = db.prepare('SELECT * FROM medicines WHERE id = ? AND userId = ?').get(req.params.id, req.userId);
  if (!med) return res.status(404).json({ error: 'Medicine not found.' });

  const inv = db.prepare('SELECT * FROM inventory WHERE medicineId = ?').get(req.params.id);
  const recentDoses = db.prepare(`
    SELECT * FROM doses WHERE medicineId = ? ORDER BY scheduledDate DESC, scheduledTime DESC LIMIT 10
  `).all(req.params.id);

  res.json({
    medicine: serialize(med),
    inventory: inv || null,
    recentDoses,
  });
});

// Create medicine
router.post('/', (req: AuthRequest, res: Response) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const {
    name,
    type = 'tablet',
    dosage = '',
    quantity = 0,
    frequency = 'once_daily',
    times = ['09:00'],
    daysOfWeek = null,
    startDate,
    endDate = null,
    foodInstruction = 'none',
    doctorName = '',
    notes = '',
    familyMemberId = null,
    minimumQuantity = 5,
  } = req.body;

  const id = uuid();
  const daysJson = Array.isArray(daysOfWeek) ? JSON.stringify(daysOfWeek) : null;

  db.prepare(`
    INSERT INTO medicines (id, userId, familyMemberId, name, type, dosage, quantity, frequency, times, daysOfWeek, startDate, endDate, foodInstruction, doctorName, notes, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    req.userId,
    familyMemberId || null,
    name.trim(),
    type,
    dosage.trim(),
    Number(quantity) || 0,
    frequency,
    JSON.stringify(times),
    daysJson,
    startDate,
    endDate || null,
    foodInstruction,
    doctorName ? doctorName.trim() : null,
    notes ? notes.trim() : null
  );

  // Initialize inventory record
  db.prepare(`
    INSERT OR REPLACE INTO inventory (id, medicineId, currentQuantity, minimumQuantity)
    VALUES (?, ?, ?, ?)
  `).run(uuid(), id, Number(quantity) || 0, Number(minimumQuantity) || 5);

  const medRow = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);

  // Generate doses for next 14 days
  const today = toDateStr(new Date());
  const endD = new Date();
  endD.setDate(endD.getDate() + 14);
  const endStr = toDateStr(endD);
  const effectiveEnd = endDate && endDate < endStr ? endDate : endStr;
  const effectiveStart = startDate > today ? startDate : today;

  generateDosesForMedicine(medRow, effectiveStart, effectiveEnd);

  res.status(201).json({ medicine: serialize(medRow) });
});

// Update medicine
router.put('/:id', (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ? AND userId = ?').get(req.params.id, req.userId) as any;
  if (!existing) return res.status(404).json({ error: 'Medicine not found.' });

  const errors = validate({ ...existing, ...req.body, times: req.body.times || JSON.parse(existing.times) });
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const {
    name = existing.name,
    type = existing.type,
    dosage = existing.dosage,
    quantity = existing.quantity,
    frequency = existing.frequency,
    times = JSON.parse(existing.times),
    daysOfWeek = existing.daysOfWeek ? JSON.parse(existing.daysOfWeek) : null,
    startDate = existing.startDate,
    endDate = existing.endDate,
    foodInstruction = existing.foodInstruction,
    doctorName = existing.doctorName,
    notes = existing.notes,
    familyMemberId = existing.familyMemberId,
    active = existing.active,
  } = req.body;

  const daysJson = Array.isArray(daysOfWeek) ? JSON.stringify(daysOfWeek) : null;

  db.prepare(`
    UPDATE medicines
    SET name = ?, type = ?, dosage = ?, quantity = ?, frequency = ?, times = ?, daysOfWeek = ?, startDate = ?, endDate = ?, foodInstruction = ?, doctorName = ?, notes = ?, familyMemberId = ?, active = ?
    WHERE id = ? AND userId = ?
  `).run(
    name.trim(),
    type,
    dosage.trim(),
    Number(quantity) || 0,
    frequency,
    JSON.stringify(times),
    daysJson,
    startDate,
    endDate || null,
    foodInstruction,
    doctorName ? doctorName.trim() : null,
    notes ? notes.trim() : null,
    familyMemberId || null,
    active ? 1 : 0,
    req.params.id,
    req.userId
  );

  const updated = db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id);

  // Regenerate future pending doses
  const today = toDateStr(new Date());
  db.prepare("DELETE FROM doses WHERE medicineId = ? AND scheduledDate >= ? AND status = 'PENDING'").run(req.params.id, today);

  const endD = new Date();
  endD.setDate(endD.getDate() + 14);
  const endStr = toDateStr(endD);
  generateDosesForMedicine(updated, today, endStr);

  res.json({ medicine: serialize(updated) });
});

// Delete medicine
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT id FROM medicines WHERE id = ? AND userId = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Medicine not found.' });

  db.prepare('DELETE FROM medicines WHERE id = ?').run(req.params.id);
  res.json({ message: 'Medicine deleted successfully.' });
});

export default router;
