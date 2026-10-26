import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db.ts';
import { authRequired, AuthRequest } from '../middleware/auth.ts';

const router = Router();
router.use(authRequired);

router.get('/logs', (req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM caregiver_logs WHERE userId = ? ORDER BY createdAt DESC LIMIT 30').all(req.userId!);
  res.json({ logs: rows });
});

router.post('/alert', (req: AuthRequest, res: Response) => {
  const { type = 'ADHERENCE_CHECK', customMessage } = req.body;
  const user = db.prepare('SELECT name, emergencyContact, phone FROM users WHERE id = ?').get(req.userId!) as any;

  if (!user?.emergencyContact) {
    return res.status(400).json({ error: 'Please configure an emergency contact in your Profile first.' });
  }

  const id = uuid();
  let message = '';

  if (type === 'MISSED_DOSE') {
    message = `[MediMate Alert] ${user.name} missed a scheduled medication dose. Please check in with them.`;
  } else if (type === 'DAILY_COMPLETE') {
    message = `[MediMate Update] Great news: ${user.name} has completed all scheduled medication doses for today!`;
  } else if (type === 'REFILL_ALERT') {
    message = `[MediMate Pharmacy Alert] One or more prescriptions for ${user.name} are running low and need refilling soon.`;
  } else {
    message = customMessage || `[MediMate Status] Routine adherence check-in message sent to ${user.emergencyContact}.`;
  }

  db.prepare(`
    INSERT INTO caregiver_logs (id, userId, emergencyContact, type, message, status)
    VALUES (?, ?, ?, ?, ?, 'SENT')
  `).run(id, req.userId, user.emergencyContact, type, message);

  // Also log into notifications
  db.prepare(`
    INSERT INTO notifications (id, userId, type, message)
    VALUES (?, ?, ?, ?)
  `).run(uuid(), req.userId, 'CAREGIVER_NOTIFICATION', message);

  const log = db.prepare('SELECT * FROM caregiver_logs WHERE id = ?').get(id);
  res.status(201).json({
    success: true,
    message: `Alert dispatched to ${user.emergencyContact}`,
    log,
  });
});

export default router;
