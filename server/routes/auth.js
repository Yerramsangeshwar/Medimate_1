const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

// ---------- Register ----------
router.post("/register", (req, res) => {
  const { name, email, password, phone, age, gender, bloodGroup, emergencyContact } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "A valid email is required." });
  if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: "An account with that email already exists." });

  const passwordHash = bcrypt.hashSync(password, 10);
  const id = uuid();

  db.prepare(`
    INSERT INTO users (id, name, email, passwordHash, phone, age, gender, bloodGroup, emergencyContact)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), email.toLowerCase().trim(), passwordHash, phone || null, age || null, gender || null, bloodGroup || null, emergencyContact || null);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  const token = signToken(id);
  res.status(201).json({ token, user: publicUser(user) });
});

// ---------- Login ----------
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: "Invalid email or password." });

  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password." });

  const token = signToken(user.id);
  res.json({ token, user: publicUser(user) });
});

// ---------- Current user ----------
router.get("/me", authRequired, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: publicUser(user) });
});

// ---------- Update profile ----------
router.put("/me", authRequired, (req, res) => {
  const { name, phone, age, gender, bloodGroup, emergencyContact } = req.body;
  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      age = COALESCE(?, age),
      gender = COALESCE(?, gender),
      bloodGroup = COALESCE(?, bloodGroup),
      emergencyContact = COALESCE(?, emergencyContact)
    WHERE id = ?
  `).run(name || null, phone || null, age ?? null, gender || null, bloodGroup || null, emergencyContact || null, req.userId);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  res.json({ user: publicUser(user) });
});

// ---------- Change password ----------
router.put("/me/password", authRequired, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!bcrypt.compareSync(currentPassword || "", user.passwordHash)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET passwordHash = ? WHERE id = ?").run(passwordHash, req.userId);
  res.json({ message: "Password updated." });
});

// ---------- Forgot / reset password (MVP: returns a reset token instead of emailing it) ----------
router.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get((email || "").toLowerCase().trim());
  // Always respond the same way so we don't leak which emails exist.
  if (!user) return res.json({ message: "If that email exists, a reset link has been generated." });

  const resetToken = jwt.sign({ userId: user.id, purpose: "reset" }, process.env.JWT_SECRET, { expiresIn: "30m" });
  // MVP: no email service wired up, so the token is returned directly for the demo/dev flow.
  res.json({ message: "Reset token generated.", resetToken });
});

router.post("/reset-password", (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  try {
    const payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    if (payload.purpose !== "reset") throw new Error("bad token");
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET passwordHash = ? WHERE id = ?").run(passwordHash, payload.userId);
    res.json({ message: "Password has been reset. You can log in now." });
  } catch (err) {
    res.status(400).json({ error: "Reset link is invalid or expired." });
  }
});

module.exports = router;
