#!/bin/bash

# Database Backup Script
# Creates a timestamped backup of the PostgreSQL database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$BACKEND_DIR")"
BACKUPS_DIR="$ROOT_DIR/backups"

# Create backups directory if it doesn't exist
mkdir -p "$BACKUPS_DIR"

# Load environment variables from .env file
if [ -f "$BACKEND_DIR/.env" ]; then
  export $(grep -v '^#' "$BACKEND_DIR/.env" | xargs)
else
  echo -e "${RED}Error: .env file not found at $BACKEND_DIR/.env${NC}"
  exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL not found in .env file${NC}"
  exit 1
fi

# Parse DATABASE_URL
# Format: postgresql://user:password@host:port/database?schema=public
DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/([^?]+)"
if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASSWORD="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[4]}"
  DB_NAME="${BASH_REMATCH[5]}"
else
  echo -e "${RED}Error: Could not parse DATABASE_URL${NC}"
  exit 1
fi

# Generate timestamp for backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUPS_DIR/cognia_insightarium_${TIMESTAMP}.sql"
BACKUP_FILE_COMPRESSED="$BACKUPS_DIR/cognia_insightarium_${TIMESTAMP}.sql.gz"

echo -e "${YELLOW}Starting database backup...${NC}"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "Backup file: $BACKUP_FILE_COMPRESSED"

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
  echo -e "${RED}Error: pg_dump command not found${NC}"
  echo "Please install PostgreSQL client tools"
  exit 1
fi

# Set PGPASSWORD environment variable for pg_dump
export PGPASSWORD="$DB_PASSWORD"

# Create backup using pg_dump
# Using custom format with compression for efficiency
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --format=custom \
  --file="$BACKUP_FILE_COMPRESSED" \
  --no-owner \
  --no-acl; then
  
  echo -e "${GREEN}✓ Backup created successfully${NC}"
  echo "Location: $BACKUP_FILE_COMPRESSED"
  
  # Get file size
  FILE_SIZE=$(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)
  echo "Size: $FILE_SIZE"
  
  # Optionally list recent backups
  echo -e "\n${YELLOW}Recent backups:${NC}"
  ls -lht "$BACKUPS_DIR" | head -6 | tail -5
  
else
  echo -e "${RED}✗ Backup failed${NC}"
  # Clean up partial backup file if it exists
  [ -f "$BACKUP_FILE_COMPRESSED" ] && rm "$BACKUP_FILE_COMPRESSED"
  exit 1
fi

# Unset PGPASSWORD for security
unset PGPASSWORD

echo -e "${GREEN}Backup completed successfully!${NC}"

