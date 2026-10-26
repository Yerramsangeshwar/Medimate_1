import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { db } from './db.ts';
import { generateDosesForMedicine, toDateStr } from './utils/scheduleEngine.ts';

export function seedDatabaseIfEmpty() {
  const email = 'demo@medimate.app';
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

  if (!user) {
    const id = uuid();
    db.prepare(`
      INSERT INTO users (id, name, email, passwordHash, phone, age, gender, bloodGroup, emergencyContact)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      'Sarah Jenkins',
      email,
      bcrypt.hashSync('demo1234', 10),
      '+1 (555) 382-9912',
      68,
      'Female',
      'O+',
      '+1 (555) 791-4401 (Daughter: Emily)'
    );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    console.log(`Created demo user: ${email} / demo1234`);
  }

  // Seed family members if empty
  const familyCount = db.prepare('SELECT COUNT(*) as c FROM family_members WHERE ownerUserId = ?').get(user.id) as { c: number };
  if (!familyCount || Number(familyCount.c) === 0) {
    db.prepare(`INSERT INTO family_members (id, ownerUserId, name, relation) VALUES (?, ?, ?, ?)`)
      .run(uuid(), user.id, 'Robert Jenkins', 'Spouse (71 yrs)');
    db.prepare(`INSERT INTO family_members (id, ownerUserId, name, relation) VALUES (?, ?, ?, ?)`)
      .run(uuid(), user.id, 'Grandma Elena', 'Mother (89 yrs)');
  }

  const today = toDateStr(new Date());
  const startDate = toDateStr(new Date(Date.now() - 7 * 86400000)); // 7 days ago

  const sampleMedicines = [
    {
      name: 'Metformin',
      type: 'tablet',
      dosage: '500mg',
      quantity: 45,
      minQty: 10,
      frequency: 'twice_daily',
      times: ['08:30', '20:30'],
      foodInstruction: 'after',
      doctorName: 'Dr. Evelyn Reed (Endocrinologist)',
      notes: 'Take with breakfast and dinner. Do not skip meals.',
    },
    {
      name: 'Lisinopril',
      type: 'tablet',
      dosage: '10mg',
      quantity: 18,
      minQty: 8,
      frequency: 'once_daily',
      times: ['09:00'],
      foodInstruction: 'none',
      doctorName: 'Dr. Michael Chen (Cardiologist)',
      notes: 'Blood pressure control. Take every morning at the same time.',
    },
    {
      name: 'Atorvastatin',
      type: 'tablet',
      dosage: '20mg',
      quantity: 8, // Low stock alert!
      minQty: 10,
      frequency: 'once_daily',
      times: ['21:30'],
      foodInstruction: 'none',
      doctorName: 'Dr. Michael Chen (Cardiologist)',
      notes: 'Cholesterol management. Evening dose.',
    },
    {
      name: 'Vitamin D3 & Calcium',
      type: 'capsule',
      dosage: '1000 IU',
      quantity: 30,
      minQty: 5,
      frequency: 'once_daily',
      times: ['13:00'],
      foodInstruction: 'after',
      doctorName: 'Dr. Sarah Alston',
      notes: 'Bone strength supplement after lunch.',
    },
    {
      name: 'Salbutamol Inhaler',
      type: 'inhaler',
      dosage: '100mcg',
      quantity: 2,
      minQty: 1,
      frequency: 'custom',
      times: ['10:00', '18:00'],
      foodInstruction: 'none',
      doctorName: 'Dr. James Wilson (Pulmonologist)',
      notes: '2 puffs as prescribed for mild bronchospasm.',
    },
  ];

  for (const m of sampleMedicines) {
    const exists = db.prepare('SELECT id FROM medicines WHERE userId = ? AND name = ?').get(user.id, m.name) as any;
    if (exists) continue;

    const id = uuid();
    db.prepare(`
      INSERT INTO medicines (id, userId, name, type, dosage, quantity, frequency, times, startDate, foodInstruction, doctorName, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      user.id,
      m.name,
      m.type,
      m.dosage,
      m.quantity,
      m.frequency,
      JSON.stringify(m.times),
      startDate,
      m.foodInstruction,
      m.doctorName,
      m.notes
    );

    db.prepare(`INSERT OR REPLACE INTO inventory (id, medicineId, currentQuantity, minimumQuantity) VALUES (?, ?, ?, ?)`)
      .run(uuid(), id, m.quantity, m.minQty);

    const medRow = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
    const endD = new Date();
    endD.setDate(endD.getDate() + 14);
    generateDosesForMedicine(medRow, startDate, toDateStr(endD));
  }

  // Populate past doses with realistic statuses (88% taken, 8% missed, 4% skipped)
  const pastDoses = db.prepare(`
    SELECT * FROM doses WHERE userId = ? AND scheduledDate < ? ORDER BY scheduledDate ASC
  `).all(user.id, today) as any[];

  const update = db.prepare('UPDATE doses SET status = ?, takenTime = ? WHERE id = ?');
  pastDoses.forEach((dose, i) => {
    const roll = i % 15;
    let status = 'TAKEN';
    if (roll === 0) status = 'MISSED';
    else if (roll === 7) status = 'SKIPPED';

    const takenTime = status === 'TAKEN' ? `${dose.scheduledDate}T${dose.scheduledTime}:00.000Z` : null;
    update.run(status, takenTime, dose.id);
  });

  // Today's doses: mark the morning doses as TAKEN if earlier than now
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;

  const todayDoses = db.prepare(`
    SELECT * FROM doses WHERE userId = ? AND scheduledDate = ? ORDER BY scheduledTime ASC
  `).all(user.id, today) as any[];

  todayDoses.forEach((dose, idx) => {
    if (dose.scheduledTime < currentTime && idx === 0) {
      update.run('TAKEN', `${today}T${dose.scheduledTime}:15.000Z`, dose.id);
    }
  });

  // Seed a sample prescription document record if empty
  const rxCount = db.prepare('SELECT COUNT(*) as c FROM prescriptions WHERE userId = ?').get(user.id) as { c: number };
  if (!rxCount || Number(rxCount.c) === 0) {
    db.prepare(`
      INSERT INTO prescriptions (id, userId, doctorName, hospitalName, date, expiryDate, fileUrl, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid(),
      user.id,
      'Dr. Michael Chen, MD',
      'Metro Health Cardiology Center',
      '2026-10-15',
      '2027-10-15',
      null,
      'Comprehensive hypertension & lipid panel follow-up. Continue Metformin and Lisinopril as scheduled.'
    );
  }

  console.log('MediMate demo data seeded successfully!');
}
