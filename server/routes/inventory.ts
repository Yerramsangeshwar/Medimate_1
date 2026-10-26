import { Router, Response } from 'express';
import { db } from '../db.ts';
import { authRequired, AuthRequest } from '../middleware/auth.ts';

const router = Router();
router.use(authRequired);

router.get('/', (req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT i.*, m.name as medicineName, m.type as medicineType, m.dosage, m.active, m.doctorName
    FROM inventory i JOIN medicines m ON m.id = i.medicineId
    WHERE m.userId = ?
    ORDER BY (i.currentQuantity <= i.minimumQuantity) DESC, m.name ASC
  `).all(req.userId!);

  res.json({ inventory: rows });
});

router.put('/:medicineId', (req: AuthRequest, res: Response) => {
  const med = db.prepare('SELECT * FROM medicines WHERE id = ? AND userId = ?').get(req.params.medicineId, req.userId!);
  if (!med) return res.status(404).json({ error: 'Medicine not found.' });

  const inv = db.prepare('SELECT * FROM inventory WHERE medicineId = ?').get(req.params.medicineId) as any;
  const { deltaQuantity, currentQuantity, minimumQuantity, expiryDate } = req.body;

  let newQty = inv ? inv.currentQuantity : 0;
  if (typeof currentQuantity === 'number') {
    newQty = Math.max(0, currentQuantity);
  } else if (typeof deltaQuantity === 'number') {
    newQty = Math.max(0, newQty + deltaQuantity);
  }

  const newMin = typeof minimumQuantity === 'number' ? Math.max(0, minimumQuantity) : inv ? inv.minimumQuantity : 5;
  const newExp = expiryDate !== undefined ? expiryDate : inv ? inv.expiryDate : null;

  db.prepare(`
    INSERT INTO inventory (id, medicineId, currentQuantity, minimumQuantity, expiryDate)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(medicineId) DO UPDATE SET
      currentQuantity = excluded.currentQuantity,
      minimumQuantity = excluded.minimumQuantity,
      expiryDate = excluded.expiryDate
  `).run(inv?.id || req.params.medicineId, req.params.medicineId, newQty, newMin, newExp);

  // Sync back to medicine table quantity as well
  db.prepare('UPDATE medicines SET quantity = ? WHERE id = ?').run(newQty, req.params.medicineId);

  const updated = db.prepare(`
    SELECT i.*, m.name as medicineName, m.type as medicineType, m.dosage
    FROM inventory i JOIN medicines m ON m.id = i.medicineId
    WHERE i.medicineId = ?
  `).get(req.params.medicineId);

  res.json({ inventoryItem: updated });
});

// Quick Refill (+30 or custom count)
router.post('/:medicineId/refill', (req: AuthRequest, res: Response) => {
  const addCount = Number(req.body.count) || 30;
  const med = db.prepare('SELECT * FROM medicines WHERE id = ? AND userId = ?').get(req.params.medicineId, req.userId!);
  if (!med) return res.status(404).json({ error: 'Medicine not found.' });

  db.prepare('UPDATE inventory SET currentQuantity = currentQuantity + ? WHERE medicineId = ?').run(addCount, req.params.medicineId);
  db.prepare('UPDATE medicines SET quantity = quantity + ? WHERE id = ?').run(addCount, req.params.medicineId);

  const updated = db.prepare(`
    SELECT i.*, m.name as medicineName, m.type as medicineType, m.dosage
    FROM inventory i JOIN medicines m ON m.id = i.medicineId
    WHERE i.medicineId = ?
  `).get(req.params.medicineId);

  res.json({ inventoryItem: updated, message: `Successfully refilled +${addCount} units.` });
});

export default router;
