import { v4 as uuid } from 'uuid';
import { db } from '../db.ts';

export function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isMedicineActiveOn(medicine: any, dateStr: string): boolean {
  if (medicine.startDate && dateStr < medicine.startDate) return false;
  if (medicine.endDate && dateStr > medicine.endDate) return false;
  if (medicine.daysOfWeek) {
    try {
      const days = JSON.parse(medicine.daysOfWeek);
      if (Array.isArray(days) && days.length > 0) {
        const dow = new Date(dateStr + 'T00:00:00').getDay();
        if (!days.includes(dow)) return false;
      }
    } catch {
      // ignore json parse error
    }
  }
  return true;
}

export function generateDosesForMedicine(medicine: any, startDate: string, endDate: string): number {
  let times: string[] = [];
  try {
    times = JSON.parse(medicine.times || '[]');
  } catch {
    times = [];
  }
  if (!times.length) return 0;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO doses (id, userId, medicineId, scheduledDate, scheduledTime, status)
    VALUES (?, ?, ?, ?, ?, 'PENDING')
  `);

  let created = 0;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  const tx = db.transaction(() => {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = toDateStr(d);
      if (!isMedicineActiveOn(medicine, dateStr)) continue;
      for (const time of times) {
        const info = insert.run(uuid(), medicine.userId, medicine.id, dateStr, time);
        if (Number(info.changes) > 0) created++;
      }
    }
  });

  tx();
  return created;
}

export function generateDosesForUser(userId: string, days = 14): number {
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

export function markOverdueAsMissed(userId: string): void {
  const now = new Date();
  const rows = db
    .prepare(`SELECT * FROM doses WHERE userId = ? AND status = 'PENDING'`)
    .all(userId);

  const update = db.prepare(`UPDATE doses SET status = 'MISSED' WHERE id = ?`);
  const tx = db.transaction(() => {
    for (const dose of rows) {
      const scheduled = new Date(`${dose.scheduledDate}T${dose.scheduledTime}:00`);
      const diffMin = (now.getTime() - scheduled.getTime()) / 60000;
      if (diffMin > 45) {
        update.run(dose.id);
      }
    }
  });
  tx();
}
