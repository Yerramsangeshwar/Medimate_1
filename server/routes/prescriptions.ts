import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { db } from '../db.ts';
import { authRequired, AuthRequest } from '../middleware/auth.ts';

const router = Router();
router.use(authRequired);

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return cb(new Error('Only PDF, JPG, PNG, and WebP files are allowed.'));
    }
    cb(null, true);
  },
});

router.get('/', (req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM prescriptions WHERE userId = ? ORDER BY createdAt DESC').all(req.userId!);
  res.json({ prescriptions: rows });
});

router.post('/', (req: AuthRequest, res: Response) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { doctorName, hospitalName, date, expiryDate, notes } = req.body;
    const id = uuid();
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    db.prepare(`
      INSERT INTO prescriptions (id, userId, doctorName, hospitalName, date, expiryDate, fileUrl, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.userId, doctorName || null, hospitalName || null, date || null, expiryDate || null, fileUrl, notes || null);

    const row = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(id);
    res.status(201).json({ prescription: row });
  });
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const row = db.prepare('SELECT * FROM prescriptions WHERE id = ? AND userId = ?').get(req.params.id, req.userId!) as any;
  if (!row) return res.status(404).json({ error: 'Prescription not found.' });

  if (row.fileUrl) {
    const filePath = path.join(uploadDir, path.basename(row.fileUrl));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore unlink error
      }
    }
  }

  db.prepare('DELETE FROM prescriptions WHERE id = ?').run(req.params.id);
  res.json({ message: 'Prescription deleted successfully.' });
});

export default router;
