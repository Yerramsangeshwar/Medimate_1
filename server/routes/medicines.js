const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { authRequired } = require("../middleware/auth");
const { generateDosesForMedicine, toDateStr } = require("../utils/scheduleEngine");

const router = express.Router();
router.use(authRequired);

const MEDICINE_TYPES = ["tablet", "capsule", "syrup", "injection", "drops", "cream", "inhaler", "powder", "other"];

function serialize(med) {
  return {
    ...med,
    times: JSON.parse(med.times || "[]"),
    daysOfWeek: med.daysOfWeek ? JSON.parse(med.daysOfWeek) : null,
    active: !!med.active,
  };
}

function validate(body) {
  const errors = [];
  if (!body.name || !body.name.trim()) errors.push("Medicine name is required.");
  if (body.type && !MEDICINE_TYPES.includes(body.type)) errors.push("Invalid medicine type.");
  if (!Array.isArray(body.times) || body.times.length === 0) errors.push("At least one dose time is required.");
  if (body.times && body.times.some((t) => !/^\d{2}:\d{2}$/.test(t))) errors.push("Times must be in HH:MM format.");
  if (!body.startDate) errors.push("Start date is required.");
  if (body.endDate && body.endDate < body.startDate) errors.push("End date cannot be before start date.");
  return errors;
}

// ---------- List ----------
router.get("/", (req, res) => {
  const { familyMemberId } = req.query;
  let rows;
  if (familyMemberId) {
    rows = db.prepare("SELECT * FROM medicines WHERE userId = ? AND familyMemberId = ? ORDER BY createdAt DESC")
      .all(req.userId, familyMemberId);
  } else {
    rows = db.prepare("SELECT * FROM medicines WHERE userId = ? ORDER BY createdAt DESC").all(req.userId);
  }
  res.json({ medicines: rows.map(serialize) });
});

// ---------- Get one ----------
router.get("/:id", (req, res) => {
  const med = db.prepare("SELECT * FROM medicines WHERE id = ? AND userId = ?").get(req.params.id, req.userId);
  if (!med) return res.status(404).json({ error: "Medicine not found." });
  const inv = db.prepare("SELECT * FROM inventory WHERE medicineId = ?").get(med.id);
  res.json({ medicine: serialize(med), inventory: inv || null });
});

// ---------- Create ----------
router.post("/", (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const {
    name, type = "tablet", dosage, quantity = 0, frequency = "custom",
    times, daysOfWeek, startDate, endDate, foodInstruction = "none",
    doctorName, notes, familyMemberId,
  } = req.body;

  const id = uuid();
  db.prepare(`
    INSERT INTO medicines
      (id, userId, familyMemberId, name, type, dosage, quantity, frequency, times, daysOfWeek,
       startDate, endDate, foodInstruction, doctorName, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.userId, familyMemberId || null, name.trim(), type, dosage || null,
    Number(quantity) || 0, frequency, JSON.stringify(times),
    daysOfWeek ? JSON.stringify(daysOfWeek) : null, startDate, endDate || null,
    foodInstruction, doctorName || null, notes || null
  );

  // Auto-create an inventory record so stock tracking works out of the box.
  db.prepare(`
    INSERT INTO inventory (id, medicineId, currentQuantity, minimumQuantity, expiryDate)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuid(), id, Number(quantity) || 0, 5, null);

  const med = db.prepare("SELECT * FROM medicines WHERE id = ?").get(id);

  // Generate the next 14 days of scheduled doses immediately.
  const start = startDate;
  const endD = new Date(startDate + "T00:00:00");
  endD.setDate(endD.getDate() + 13);
  generateDosesForMedicine(med, start, toDateStr(endD));

  res.status(201).json({ medicine: serialize(med) });
});

// ---------- Update ----------
router.put("/:id", (req, res) => {
  const med = db.prepare("SELECT * FROM medicines WHERE id = ? AND userId = ?").get(req.params.id, req.userId);
  if (!med) return res.status(404).json({ error: "Medicine not found." });

  const merged = {
    name: req.body.name ?? med.name,
    type: req.body.type ?? med.type,
    dosage: req.body.dosage ?? med.dosage,
    quantity: req.body.quantity ?? med.quantity,
    frequency: req.body.frequency ?? med.frequency,
    times: req.body.times ?? JSON.parse(med.times),
    daysOfWeek: req.body.daysOfWeek !== undefined ? req.body.daysOfWeek : (med.daysOfWeek ? JSON.parse(med.daysOfWeek) : null),
    startDate: req.body.startDate ?? med.startDate,
    endDate: req.body.endDate !== undefined ? req.body.endDate : med.endDate,
    foodInstruction: req.body.foodInstruction ?? med.foodInstruction,
    doctorName: req.body.doctorName ?? med.doctorName,
    notes: req.body.notes ?? med.notes,
    active: req.body.active !== undefined ? (req.body.active ? 1 : 0) : med.active,
  };

  const errors = validate(merged);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  db.prepare(`
    UPDATE medicines SET
      name=?, type=?, dosage=?, quantity=?, frequency=?, times=?, daysOfWeek=?,
      startDate=?, endDate=?, foodInstruction=?, doctorName=?, notes=?, active=?
    WHERE id = ?
  `).run(
    merged.name.trim(), merged.type, merged.dosage, Number(merged.quantity) || 0, merged.frequency,
    JSON.stringify(merged.times), merged.daysOfWeek ? JSON.stringify(merged.daysOfWeek) : null,
    merged.startDate, merged.endDate || null, merged.foodInstruction, merged.doctorName, merged.notes,
    merged.active, req.params.id
  );

  const updated = db.prepare("SELECT * FROM medicines WHERE id = ?").get(req.params.id);

  // Regenerate upcoming doses so schedule changes take effect (existing history is untouched).
  const today = toDateStr(new Date());
  const endD = new Date();
  endD.setDate(endD.getDate() + 13);
  db.prepare(`DELETE FROM doses WHERE medicineId = ? AND scheduledDate >= ? AND status = 'PENDING'`).run(req.params.id, today);
  generateDosesForMedicine(updated, today, toDateStr(endD));

  res.json({ medicine: serialize(updated) });
});

// ---------- Delete ----------
router.delete("/:id", (req, res) => {
  const med = db.prepare("SELECT * FROM medicines WHERE id = ? AND userId = ?").get(req.params.id, req.userId);
  if (!med) return res.status(404).json({ error: "Medicine not found." });
  db.prepare("DELETE FROM medicines WHERE id = ?").run(req.params.id);
  res.json({ message: "Medicine deleted." });
});

module.exports = router;
