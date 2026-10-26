const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM family_members WHERE ownerUserId = ? ORDER BY createdAt ASC").all(req.userId);
  res.json({ familyMembers: rows });
});

router.post("/", (req, res) => {
  const { name, relation } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
  const id = uuid();
  db.prepare("INSERT INTO family_members (id, ownerUserId, name, relation) VALUES (?, ?, ?, ?)")
    .run(id, req.userId, name.trim(), relation || null);
  const row = db.prepare("SELECT * FROM family_members WHERE id = ?").get(id);
  res.status(201).json({ familyMember: row });
});

router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM family_members WHERE id = ? AND ownerUserId = ?").get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: "Family member not found." });
  db.prepare("DELETE FROM family_members WHERE id = ?").run(req.params.id);
  res.json({ message: "Family member removed." });
});

module.exports = router;
