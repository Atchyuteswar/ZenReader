import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve('data.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT, -- Null for Google users
    googleId TEXT UNIQUE,
    name TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    cover TEXT, -- Base64 or URL
    filePath TEXT NOT NULL,
    addedAt INTEGER NOT NULL,
    lastRead INTEGER,
    progress TEXT,
    progressPercentage REAL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

export default db;
