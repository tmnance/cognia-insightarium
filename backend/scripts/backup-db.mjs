#!/usr/bin/env node

/**
 * Database Backup Script (Node.js version)
 * Creates a timestamped backup of the PostgreSQL database
 * 
 * Usage: node scripts/backup-db.mjs
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get directories
const BACKEND_DIR = join(__dirname, '..');
const ROOT_DIR = join(BACKEND_DIR, '..');
const BACKUPS_DIR = join(ROOT_DIR, 'backups');

// Create backups directory if it doesn't exist
if (!existsSync(BACKUPS_DIR)) {
  mkdirSync(BACKUPS_DIR, { recursive: true });
  console.log(`Created backups directory: ${BACKUPS_DIR}`);
}

// Load environment variables
const envPath = join(BACKEND_DIR, '.env');
if (!existsSync(envPath)) {
  console.error(`Error: .env file not found at ${envPath}`);
  process.exit(1);
}

dotenv.config({ path: envPath });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL not found in .env file');
  process.exit(1);
}

// Parse DATABASE_URL
// Format: postgresql://user:password@host:port/database?schema=public
const dbUrlMatch = DATABASE_URL.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):([^/]+)\/([^?]+)/);
if (!dbUrlMatch) {
  console.error('Error: Could not parse DATABASE_URL');
  process.exit(1);
}

const [, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME] = dbUrlMatch;

// Generate timestamp for backup filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
const backupFile = join(BACKUPS_DIR, `cognia_insightarium_${timestamp}.dump`);

console.log('Starting database backup...');
console.log(`Database: ${DB_NAME}`);
console.log(`Host: ${DB_HOST}:${DB_PORT}`);
console.log(`Backup file: ${backupFile}`);

// Check if pg_dump is available
try {
  execSync('which pg_dump', { stdio: 'ignore' });
} catch (error) {
  console.error('Error: pg_dump command not found');
  console.error('Please install PostgreSQL client tools');
  process.exit(1);
}

try {
  // Create backup using pg_dump with custom format (compressed)
  // Using custom format for efficiency and better compression
  const pgDumpCommand = `PGPASSWORD='${DB_PASSWORD}' pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} --format=custom --file='${backupFile}' --no-owner --no-acl`;
  
  execSync(pgDumpCommand, { stdio: 'inherit', env: { ...process.env } });
  
  console.log('✓ Backup created successfully');
  console.log(`Location: ${backupFile}`);
  
  // Get file size
  try {
    const stats = statSync(backupFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Size: ${fileSizeMB} MB`);
  } catch (error) {
    // File size check failed, but backup succeeded
  }
  
  console.log('\nBackup completed successfully!');
  
} catch (error) {
  console.error('✗ Backup failed');
  console.error(error.message);
  process.exit(1);
}

