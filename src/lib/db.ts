import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { readFileSync } from 'fs';

const DB_PATH = path.join(process.cwd(), '.data', 'rss.db');

// Ensure .data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema migrations
const schema = readFileSync(path.join(process.cwd(), 'src', 'lib', 'schema.sql'), 'utf-8');
db.exec(schema);

// Migration: add matched_rule_ids column to articles if missing
try {
  db.exec("ALTER TABLE articles ADD COLUMN matched_rule_ids TEXT DEFAULT ''");
} catch {
  // Column already exists
}

export default db;
