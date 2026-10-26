const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.includes(ext)) return cb(new Error("Only PDF, JPG, and PNG files are allowed."));
    cb(null, true);
  },
});

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM prescriptions WHERE userId = ? ORDER BY createdAt DESC").all(req.userId);
  res.json({ prescriptions: rows });
});

router.post("/", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { doctorName, hospitalName, date, expiryDate, notes } = req.body;
    const id = uuid();
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    db.prepare(`
      INSERT INTO prescriptions (id, userId, doctorName, hospitalName, date, expiryDate, fileUrl, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.userId, doctorName || null, hospitalName || null, date || null, expiryDate || null, fileUrl, notes || null);

    const row = db.prepare("SELECT * FROM prescriptions WHERE id = ?").get(id);
    res.status(201).json({ prescription: row });
  });
});

router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM prescriptions WHERE id = ? AND userId = ?").get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: "Prescription not found." });
  if (row.fileUrl) {
    const filePath = path.join(uploadDir, path.basename(row.fileUrl));
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
  }
  db.prepare("DELETE FROM prescriptions WHERE id = ?").run(req.params.id);
  res.json({ message: "Prescription deleted." });
});

module.exports = router;
