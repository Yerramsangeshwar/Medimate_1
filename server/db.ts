import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'medimate.db');
const raw = new DatabaseSync(dbPath);

raw.exec('PRAGMA journal_mode = WAL');
raw.exec('PRAGMA foreign_keys = ON');

export interface StatementWrapper {
  run: (...params: any[]) => { changes: number | bigint; lastInsertRowid: number | bigint };
  get: <T = any>(...params: any[]) => T | undefined;
  all: <T = any>(...params: any[]) => T[];
}

export const db = {
  exec: (sql: string) => raw.exec(sql),
  prepare: (sql: string): StatementWrapper => {
    const stmt = raw.prepare(sql);
    return {
      run: (...params: any[]) => stmt.run(...params),
      get: <T = any>(...params: any[]) => stmt.get(...params) as T | undefined,
      all: <T = any>(...params: any[]) => stmt.all(...params) as T[],
    };
  },
  transaction: <T extends (...args: any[]) => any>(fn: T): T => {
    return ((...args: any[]) => {
      try {
        raw.exec('SAVEPOINT tx_point');
        const res = fn(...args);
        raw.exec('RELEASE SAVEPOINT tx_point');
        return res;
      } catch (err) {
        raw.exec('ROLLBACK TO SAVEPOINT tx_point');
        throw err;
      }
    }) as T;
  },
};

// Initialize schema
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
  frequency TEXT NOT NULL,
  times TEXT NOT NULL,
  daysOfWeek TEXT,
  startDate TEXT NOT NULL,
  endDate TEXT,
  foodInstruction TEXT DEFAULT 'none',
  doctorName TEXT,
  notes TEXT,
  active INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doses (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medicineId TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  scheduledDate TEXT NOT NULL,
  scheduledTime TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
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

CREATE TABLE IF NOT EXISTS caregiver_logs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emergencyContact TEXT,
  type TEXT,
  message TEXT,
  status TEXT DEFAULT 'SENT',
  createdAt TEXT DEFAULT (datetime('now'))
);
`);
