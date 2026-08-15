import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ?? (process.env.VERCEL
    ? path.join('/tmp', 'hcet-data')
    : path.join(process.cwd(), 'data'));
const DB_PATH = path.join(DATA_DIR, 'hcet.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operative',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS operatives (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      loc TEXT NOT NULL,
      sector TEXT NOT NULL,
      status TEXT NOT NULL,
      force_level INTEGER NOT NULL DEFAULT 3,
      compromised INTEGER NOT NULL DEFAULT 0,
      map_x REAL,
      map_y REAL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      num TEXT NOT NULL,
      name TEXT NOT NULL,
      objective TEXT NOT NULL,
      coordinator TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'info',
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recruits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL UNIQUE,
      location TEXT NOT NULL,
      force_potential INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'pending',
      submitted_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS safe_houses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      occupancy INTEGER NOT NULL DEFAULT 0,
      routable INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS comms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      tag TEXT NOT NULL,
      message TEXT NOT NULL,
      operative TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      tag TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function seedDatabase() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  const getPasswordForName = (name: string) => bcrypt.hashSync(name.trim().slice(0, 2).toUpperCase() + '02', 10);
  const insertUser = db.prepare('INSERT INTO users (name, password_hash, role) VALUES (?, ?, ?)');

  const users = [
    ['Obi-Wan Kenobi', 'commander'],
    ['Yoda', 'commander'],
    ['Ahsoka Tano', 'operative'],
    ['Kanan Jarrus', 'operative'],
    ['Kaelen Vance', 'operative'],
    ['Jinxsha', 'operative'],
  ];

  for (const [name, role] of users) {
    const passwordHash = getPasswordForName(name);
    if (userCount.c > 0) {
      db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE LOWER(name) = LOWER(?)').run(passwordHash, role, name);
    } else {
      insertUser.run(name, passwordHash, role);
    }
  }

  if (userCount.c > 0) return;

  const insertOp = db.prepare(`
    INSERT INTO operatives (id, name, loc, sector, status, force_level, compromised, map_x, map_y)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const operatives = [
    ['001_KENOBI', 'OBI-WAN KENOBI', 'Tatooine', 'outer rim', 'secure', 5, 0, 0.15, 0.30],
    ['002_JARRUS', 'KANAN JARRUS', 'Lothal', 'outer rim', 'compromised', 4, 1, 0.38, 0.55],
    ['003_TANO', 'AHSOKA TANO', '[REDACTED]', 'unknown', 'in-transit', 5, 0, 0.60, 0.20],
    ['004_YODA', 'YODA', 'Dagobah', 'outer rim', 'secure', 5, 0, 0.80, 0.60],
    ['005_WINDU', 'MACE WINDU', '[UNKNOWN]', 'unknown', 'pending', 4, 0, 0.50, 0.75],
    ['006_VANCE', 'KAELEN VANCE', 'Corellia', 'core worlds', 'active-chip', 3, 0, 0.25, 0.70],
    ['007_REN', 'LYRA REN', 'Coruscant', 'core worlds', 'compromised', 2, 1, 0.70, 0.40],
    ['008_KARR', 'TALON KARR', 'Mandalore', 'mid rim', 'pending', 3, 0, 0.45, 0.35],
    ['009_KRYZE', 'BO-KATAN KRYZE', 'Mandalore', 'mid rim', 'active-chip', 2, 0, 0.55, 0.45],
    ['010_SYNDULLA', 'HERA SYNDULLA', 'Lothal', 'outer rim', 'active-chip', 1, 0, 0.35, 0.65],
  ];

  for (const op of operatives) {
    insertOp.run(...op);
  }

  const insertMission = db.prepare(`
    INSERT INTO missions (num, name, objective, coordinator, status, priority) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const missions = [
    ['001_', 'Operation Nightfall', 'OBJ: Sabotage primary shield generator on Endor Moon.', 'R. KRYZE', 'critical', 'critical'],
    ['002_', 'Sector 7 Extraction', "OBJ: Retrieve deep-cover operative matching alias 'FULCRUM'.", 'C. SYNDULLA', 'in-progress', 'high'],
    ['003_', 'Supply Run: Tatooine', 'OBJ: Secure medical supplies from Hutt Cartel contacts.', 'H. SOLO', 'completed', 'low'],
    ['004_', 'Phantom Signal', 'OBJ: Trace origin of encrypted rebel transmission from Lothal.', 'K. JARRUS', 'in-progress', 'medium'],
  ];

  for (const m of missions) {
    insertMission.run(...m);
  }

  const insertAlert = db.prepare(`
    INSERT INTO alerts (title, description, priority, icon, expires_at) VALUES (?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  const alerts = [
    ['INQUISITOR DETECTED — SECTOR 4', 'Seventh Sister identified en route to Lothal. All operatives in sector advised to go dark immediately.', 'critical', 'crit', new Date(now + 2 * 3600000).toISOString()],
    ['COMMS BLACKOUT — OUTER RIM', 'All encrypted channels to Outer Rim systems are non-responsive. Last contact 6 hrs ago.', 'high', 'crit', new Date(now + 6 * 3600000).toISOString()],
    ['ENCRYPTED TRANSMISSION INTERCEPTED', 'Imperial frequency burst detected near Corellia. Decryption in progress — 47% complete.', 'medium', 'warn', new Date(now + 12 * 3600000).toISOString()],
    ['SUPPLY CACHE LOCATED — MANDALORE', 'Anonymous tip confirmed. Cache contains rations, medkits and 2 encrypted datapads. Retrieval team dispatched.', 'low', 'info', new Date(now + 18 * 3600000).toISOString()],
    ['NEW RECRUIT SIGNAL DETECTED', 'Force-sensitive signature identified near Nar Shaddaa. Cross-referencing with pre-Order 66 Jedi archives.', 'low', 'info', new Date(now + 21 * 3600000).toISOString()],
  ];

  for (const a of alerts) {
    insertAlert.run(...a);
  }

  const insertRecruit = db.prepare(`
    INSERT INTO recruits (request_id, location, force_potential, status) VALUES (?, ?, ?, ?)
  `);

  const recruits = [
    ['REQ-8819A', 'OUTER RIM // TARIS', 3, 'pending'],
    ['REQ-3320B', 'CORE // CORUSCANT L-13', 4, 'compromised'],
    ['REQ-9912C', 'UNKNOWN // SECTOR 4', 5, 'secure'],
  ];

  for (const r of recruits) {
    insertRecruit.run(...r);
  }

  const insertSH = db.prepare(`
    INSERT INTO safe_houses (name, status, capacity, occupancy, routable) VALUES (?, ?, ?, ?, ?)
  `);

  const safeHouses = [
    ['OUTPOST AURORA', 'ACTIVE // COVERT', 12, 8, 1],
    ['ECHO BASE SUB-LEVEL', 'OFFLINE // MAINT', 50, 0, 0],
    ['HAVEN THETA-7', 'ACTIVE // COVERT', 40, 23, 1],
  ];

  for (const sh of safeHouses) {
    insertSH.run(...sh);
  }

  const insertComms = db.prepare(`
    INSERT INTO comms_logs (type, tag, message, operative) VALUES (?, ?, ?, ?)
  `);

  const comms = [
    ['secure', '[SECURE]', "Operative 'Kael' reports target acquisition on Nar Shaddaa. Potential extremely high.", 'Kaelen Vance'],
    ['warn', '[WARNING]', 'Inquisitor activity detected near Safe House Delta. Evacuation protocols initiated.', null],
    ['sys', '[SYSTEM]', 'Automated scan complete. 3 new anomalies added to vetting queue.', null],
    ['secure', '[SECURE]', 'Encrypted handshake confirmed with operative on Dagobah.', 'Yoda'],
  ];

  for (const c of comms) {
    insertComms.run(...c);
  }

  const insertSysLog = db.prepare(`
    INSERT INTO system_logs (type, tag, message) VALUES (?, ?, ?)
  `);

  const sysLogs = [
    ['sys', '[BOOT]', 'HCET Syndicate terminal initialized. Encryption layer: OMEGA-9.'],
    ['sys', '[AUTH]', 'Operative identity verified. Welcome to HCET Syndicate.'],
    ['secure', '[NET]', 'Secure tunnel established to relay station DELTA-9.'],
    ['sys', '[SYNC]', 'Registry sync complete. 156 operatives confirmed active.'],
    ['warn', '[WARN]', 'Anomalous packet detected on channel 7. Flagged for review.'],
    ['secure', '[INTEL]', 'New intelligence uploaded: Imperial cruiser sighted near Sector 4.'],
    ['warn', '[ALERT]', 'Safe House Delta: Evacuation protocol triggered. 12 operatives relocated.'],
    ['sys', '[SCAN]', 'Automated vetting scan: 3 new anomalies queued for review.'],
    ['secure', '[COMMS]', 'Encrypted handshake confirmed. Node: DAGOBAH-ALPHA.'],
    ['sys', '[CACHE]', 'Supply cache on Mandalore verified. Retrieval ETA: 04:00:00.'],
    ['warn', '[SIGNAL]', 'Force-sensitive signature detected — Nar Shaddaa. Vetting request auto-generated.'],
  ];

  for (const l of sysLogs) {
    insertSysLog.run(...l);
  }
}

export function getStats(onlineCount = 0) {
  const total = (db.prepare('SELECT COUNT(*) as c FROM operatives').get() as { c: number }).c;
  const critical = (db.prepare("SELECT COUNT(*) as c FROM operatives WHERE status IN ('compromised', 'critical') OR compromised = 1").get() as { c: number }).c;
  const deployed = (db.prepare("SELECT COUNT(*) as c FROM operatives WHERE status IN ('active-chip', 'in-transit', 'secure')").get() as { c: number }).c;
  const compromised = (db.prepare('SELECT COUNT(*) as c FROM operatives WHERE compromised = 1').get() as { c: number }).c;
  const registeredUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const commsIntegrity = total > 0 ? Math.round(((total - compromised) / total) * 1000) / 10 : 100;

  return {
    totalActive: total,
    criticalStatus: critical,
    operativesDeployed: deployed,
    commsIntegrity,
    onlineUsers: onlineCount,
    registeredUsers,
  };
}
