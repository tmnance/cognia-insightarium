# Database Backups

This directory contains database backups created by the backup script.

## Creating a Backup

From the repo root:

```bash
npm run backup:db
```

Or from the backend directory:

```bash
npm run backup:db
```

Or using the script directly (from `backend/`):

```bash
node scripts/backup-db.mjs
```

Or using the bash script (from `backend/`):

```bash
./scripts/backup-db.sh
```

## Backup Files

Backup files are named with the format:
- `cognia_insightarium_YYYYMMDD_HHMMSS.dump`

Backups are created using PostgreSQL's custom format (compressed) which is:
- More efficient than plain SQL
- Supports selective restore
- Compressed for smaller file sizes

## Restoring a Backup

To restore a backup, use `pg_restore`:

```bash
pg_restore -h localhost -p 5432 -U postgres -d cognia_insightarium --clean --if-exists backups/cognia_insightarium_YYYYMMDD_HHMMSS.dump
```

Or using the DATABASE_URL from your .env:

```bash
PGPASSWORD=your_password pg_restore -h localhost -p 5432 -U postgres -d cognia_insightarium --clean --if-exists backups/cognia_insightarium_YYYYMMDD_HHMMSS.dump
```

**Warning**: The `--clean --if-exists` flags will drop existing database objects before restoring. Use with caution!

## Note

Backup files are ignored by git (see `.gitignore`). Make sure to store backups in a safe location if you need to keep them long-term.

