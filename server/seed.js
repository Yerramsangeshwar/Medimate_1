require("dotenv").config();
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const db = require("./db");
const { generateDosesForMedicine, toDateStr } = require("./utils/scheduleEngine");

console.log("Seeding MediMate demo data...");

const email = "demo@medimate.app";
let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

if (!user) {
  const id = uuid();
  db.prepare(`
    INSERT INTO users (id, name, email, passwordHash, phone, age, gender, bloodGroup, emergencyContact)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, "Demo User", email, bcrypt.hashSync("demo1234", 10),
    "9876543210", 27, "Other", "O+", "9876500000"
  );
  user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  console.log(`Created demo user: ${email} / demo1234`);
} else {
  console.log("Demo user already exists, reusing it.");
}

const today = toDateStr(new Date());
const startDate = toDateStr(new Date(Date.now() - 5 * 86400000)); // started 5 days ago

const sampleMedicines = [
  { name: "Paracetamol", type: "tablet", dosage: "500mg", quantity: 20, frequency: "twice_daily", times: ["09:00", "21:00"], foodInstruction: "after", doctorName: "Dr. Kumar" },
  { name: "Vitamin D3", type: "capsule", dosage: "1000 IU", quantity: 10, frequency: "once_daily", times: ["13:00"], foodInstruction: "after", doctorName: "Dr. Kumar" },
  { name: "Cetirizine", type: "tablet", dosage: "10mg", quantity: 6, frequency: "once_daily", times: ["21:00"], foodInstruction: "none", doctorName: "Dr. Reddy" },
];

for (const m of sampleMedicines) {
  const exists = db.prepare("SELECT id FROM medicines WHERE userId = ? AND name = ?").get(user.id, m.name);
  if (exists) continue;

  const id = uuid();
  db.prepare(`
    INSERT INTO medicines (id, userId, name, type, dosage, quantity, frequency, times, startDate, foodInstruction, doctorName)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, user.id, m.name, m.type, m.dosage, m.quantity, m.frequency, JSON.stringify(m.times), startDate, m.foodInstruction, m.doctorName);

  db.prepare(`INSERT INTO inventory (id, medicineId, currentQuantity, minimumQuantity) VALUES (?, ?, ?, ?)`)
    .run(uuid(), id, m.quantity, 5);

  const medRow = db.prepare("SELECT * FROM medicines WHERE id = ?").get(id);
  const endD = new Date();
  endD.setDate(endD.getDate() + 13);
  generateDosesForMedicine(medRow, startDate, toDateStr(endD));
}

// Give some historical doses realistic statuses so the calendar/adherence chart has data.
const pastDoses = db.prepare(`
  SELECT * FROM doses WHERE userId = ? AND scheduledDate < ? ORDER BY scheduledDate ASC
`).all(user.id, today);

const update = db.prepare("UPDATE doses SET status = ?, takenTime = ? WHERE id = ?");
pastDoses.forEach((dose, i) => {
  // Roughly 85% taken, 10% missed, 5% skipped for a realistic adherence percentage.
  const roll = i % 20;
  let status = "TAKEN";
  if (roll === 0) status = "MISSED";
  else if (roll === 1) status = "SKIPPED";
  const takenTime = status === "TAKEN" ? new Date(`${dose.scheduledDate}T${dose.scheduledTime}:00`).toISOString() : null;
  update.run(status, takenTime, dose.id);
});

console.log(`Seed complete. Log in with: ${email} / demo1234`);
