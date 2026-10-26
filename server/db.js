const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "medimate.db");
const raw = new DatabaseSync(dbPath);

raw.exec("PRAGMA journal_mode = WAL");
raw.exec("PRAGMA foreign_keys = ON");

// Thin wrapper so the rest of the app can keep using the better-sqlite3-style
// db.prepare(sql).run/get/all(...) API without changing every route file.
const db = {
  exec: (sql) => raw.exec(sql),
  prepare: (sql) => {
    const stmt = raw.prepare(sql);
    return {
      run: (...params) => stmt.run(...params),
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
    };
  },
  // better-sqlite3 had db.transaction(fn) -> fn(); node:sqlite doesn't, so
  // this just runs the function directly (fine at this app's scale).
  transaction: (fn) => (...args) => fn(...args),
};

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  phone TEXT,
  age INTEGER,
  gender TEXT,
  bloodGroup TEXT,
  emergencyContact TEXT,
  role TEXT DEFAULT 'USER',
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  ownerUserId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relation TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  familyMemberId TEXT REFERENCES family_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'tablet',
  dosage TEXT,
  quantity INTEGER DEFAULT 0,
  frequency TEXT NOT NULL,          -- JSON string describing schedule
  times TEXT NOT NULL,              -- JSON array of "HH:MM" times
  daysOfWeek TEXT,                  -- JSON array [0-6] or null = every day
  startDate TEXT NOT NULL,
  endDate TEXT,
  foodInstruction TEXT DEFAULT 'none', -- before/after/none
  doctorName TEXT,
  notes TEXT,
  active INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doses (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medicineId TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  scheduledDate TEXT NOT NULL,   -- YYYY-MM-DD
  scheduledTime TEXT NOT NULL,   -- HH:MM
  status TEXT DEFAULT 'PENDING', -- TAKEN / MISSED / SKIPPED / PENDING / SNOOZED
  takenTime TEXT,
  UNIQUE(medicineId, scheduledDate, scheduledTime)
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  medicineId TEXT NOT NULL UNIQUE REFERENCES medicines(id) ON DELETE CASCADE,
  currentQuantity INTEGER DEFAULT 0,
  minimumQuantity INTEGER DEFAULT 5,
  expiryDate TEXT
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctorName TEXT,
  hospitalName TEXT,
  date TEXT,
  expiryDate TEXT,
  fileUrl TEXT,
  notes TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT,
  message TEXT,
  read INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
);
`);

module.exports = db;
