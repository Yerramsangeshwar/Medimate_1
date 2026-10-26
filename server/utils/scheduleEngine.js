const { v4: uuid } = require("uuid");
const db = require("../db");

/**
 * Medicine.frequency is one of:
 *   "once_daily" | "twice_daily" | "thrice_daily" | "every_x_hours" | "custom"
 * Medicine.times is a JSON array of "HH:MM" strings (the actual dose clock-times).
 * Medicine.daysOfWeek is a JSON array of ints 0-6 (0=Sun) or null for every day.
 *
 * This engine just needs `times` + optional `daysOfWeek` — frequency label is
 * mostly informational/for the UI, since `times` already encodes how many
 * doses per day and at what clock times (this also cleanly supports
 * "every X hours" once the UI expands that into concrete times).
 */

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function isMedicineActiveOn(medicine, dateStr) {
  if (medicine.startDate && dateStr < medicine.startDate) return false;
  if (medicine.endDate && dateStr > medicine.endDate) return false;
  if (medicine.daysOfWeek) {
    const days = JSON.parse(medicine.daysOfWeek);
    if (Array.isArray(days) && days.length > 0) {
      const dow = new Date(dateStr + "T00:00:00").getDay();
      if (!days.includes(dow)) return false;
    }
  }
  return true;
}

/** Ensure dose rows exist for a single medicine across [startDate, endDate] inclusive (YYYY-MM-DD strings). */
function generateDosesForMedicine(medicine, startDate, endDate) {
  const times = JSON.parse(medicine.times || "[]");
  if (!times.length) return 0;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO doses (id, userId, medicineId, scheduledDate, scheduledTime, status)
    VALUES (?, ?, ?, ?, ?, 'PENDING')
  `);

  let created = 0;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  const tx = db.transaction(() => {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = toDateStr(d);
      if (!isMedicineActiveOn(medicine, dateStr)) continue;
      for (const time of times) {
        const info = insert.run(uuid(), medicine.userId, medicine.id, dateStr, time);
        if (info.changes) created++;
      }
    }
  });
  tx();
  return created;
}

/** Generate doses for ALL active medicines of a user for a date window (default: today .. today+13). */
function generateDosesForUser(userId, days = 14) {
  const medicines = db
    .prepare(`SELECT * FROM medicines WHERE userId = ? AND active = 1`)
    .all(userId);

  const today = new Date();
  const start = toDateStr(today);
  const endD = new Date(today);
  endD.setDate(endD.getDate() + days - 1);
  const end = toDateStr(endD);

  let total = 0;
  for (const med of medicines) {
    total += generateDosesForMedicine(med, start, end);
  }
  return total;
}

/** Any PENDING dose whose scheduled date+time is >45 min in the past becomes MISSED. */
function markOverdueAsMissed(userId) {
  const now = new Date();
  const rows = db
    .prepare(`SELECT * FROM doses WHERE userId = ? AND status = 'PENDING'`)
    .all(userId);

  const update = db.prepare(`UPDATE doses SET status = 'MISSED' WHERE id = ?`);
  const tx = db.transaction(() => {
    for (const dose of rows) {
      const scheduled = new Date(`${dose.scheduledDate}T${dose.scheduledTime}:00`);
      const diffMin = (now - scheduled) / 60000;
      if (diffMin > 45) {
        update.run(dose.id);
      }
    }
  });
  tx();
}

module.exports = {
  toDateStr,
  generateDosesForMedicine,
  generateDosesForUser,
  markOverdueAsMissed,
};
