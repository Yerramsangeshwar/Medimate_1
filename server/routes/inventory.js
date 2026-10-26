const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

router.get("/", (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, m.name as medicineName, m.type as medicineType
    FROM inventory i JOIN medicines m ON m.id = i.medicineId
    WHERE m.userId = ?
    ORDER BY m.name ASC
  `).all(req.userId);
  res.json({ inventory: rows });
});

// Adjust stock, e.g. after a refill purchase: { deltaQuantity: 30 } or set exact { currentQuantity: 40 }
router.put("/:medicineId", (req, res) => {
  const med = db.prepare("SELECT * FROM medicines WHERE id = ? AND userId = ?").get(req.params.medicineId, req.userId);
  if (!med) return res.status(404).json({ error: "Medicine not found." });

  const inv = db.prepare("SELECT * FROM inventory WHERE medicineId = ?").get(req.params.medicineId);
  const { deltaQuantity, currentQuantity, minimumQuantity, expiryDate } = req.body;

  let newQty = inv.currentQuantity;
  if (currentQuantity !== undefined) newQty = Number(currentQuantity);
  else if (deltaQuantity !== undefined) newQty = Math.max(0, inv.currentQuantity + Number(deltaQuantity));

  db.prepare(`
    UPDATE inventory SET currentQuantity = ?, minimumQuantity = COALESCE(?, minimumQuantity), expiryDate = COALESCE(?, expiryDate)
    WHERE medicineId = ?
  `).run(newQty, minimumQuantity ?? null, expiryDate ?? null, req.params.medicineId);

  const updated = db.prepare("SELECT * FROM inventory WHERE medicineId = ?").get(req.params.medicineId);
  res.json({ inventory: updated });
});

module.exports = router;
