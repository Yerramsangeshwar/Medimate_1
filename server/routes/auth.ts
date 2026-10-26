import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { db } from '../db.ts';
import { authRequired, AuthRequest, JWT_SECRET } from '../middleware/auth.ts';
import { seedDatabaseIfEmpty } from '../seed.ts';

const router = Router();

function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: '7d',
  } as jwt.SignOptions);
}

function publicUser(u: any) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

// Quick Demo Login (auto-seeds if fresh)
router.post('/demo', (_req, res) => {
  seedDatabaseIfEmpty();
  const demoEmail = 'demo@medimate.app';
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(demoEmail) as any;
  if (!user) {
    return res.status(500).json({ error: 'Could not initialize demo user.' });
  }
  const token = signToken(user.id);
  res.json({ token, user: publicUser(user) });
});

// Register
router.post('/register', (req, res) => {
  const { name, email, password, phone, age, gender, bloodGroup, emergencyContact } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const id = uuid();

  db.prepare(`
    INSERT INTO users (id, name, email, passwordHash, phone, age, gender, bloodGroup, emergencyContact)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), email.toLowerCase().trim(), passwordHash, phone || null, age ? Number(age) : null, gender || null, bloodGroup || null, emergencyContact || null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const token = signToken(id);
  res.status(201).json({ token, user: publicUser(user) });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const normalizedEmail = email.toLowerCase().trim();
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as any;

  // Auto-seed if someone attempts demo login on unseeded database
  if (!user && normalizedEmail === 'demo@medimate.app') {
    seedDatabaseIfEmpty();
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as any;
  }

  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

  const token = signToken(user.id);
  res.json({ token, user: publicUser(user) });
});

// Current user
router.get('/me', authRequired, (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

// Update Profile
router.put('/me', authRequired, (req: AuthRequest, res: Response) => {
  const { name, phone, age, gender, bloodGroup, emergencyContact } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });

  db.prepare(`
    UPDATE users
    SET name = ?, phone = ?, age = ?, gender = ?, bloodGroup = ?, emergencyContact = ?
    WHERE id = ?
  `).run(name.trim(), phone || null, age ? Number(age) : null, gender || null, bloodGroup || null, emergencyContact || null, req.userId);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ user: publicUser(user) });
});

// Change Password
router.put('/me/password', authRequired, (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as any;
  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.userId);
  res.json({ message: 'Password updated successfully.' });
});

// Forgot / Reset Password Mock-Friendly flows
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) {
    return res.json({ message: 'If that email exists, password reset instructions have been simulated.' });
  }
  const resetToken = jwt.sign({ userId: (user as any).id, purpose: 'reset' }, JWT_SECRET, { expiresIn: '1h' } as jwt.SignOptions);
  res.json({
    message: 'Reset instructions generated.',
    simulatedResetToken: resetToken,
  });
});

router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.purpose !== 'reset') throw new Error();
    db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), payload.userId);
    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch {
    res.status(400).json({ error: 'Invalid or expired reset token.' });
  }
});

export default router;
