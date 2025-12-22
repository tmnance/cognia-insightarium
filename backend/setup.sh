#!/bin/bash

# Setup script for Cognia Insightarium Backend
# This script helps set up the database and Prisma

echo "🚀 Setting up Cognia Insightarium Backend..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file in the backend directory with DATABASE_URL set."
    echo ""
    echo "Example .env file:"
    echo "DATABASE_URL=postgresql://user:password@localhost:5432/cognia_insightarium?schema=public"
    exit 1
fi

# Check if DATABASE_URL is set
if ! grep -q "DATABASE_URL=" .env || grep -q "DATABASE_URL=postgresql://user:password" .env; then
    echo "⚠️  Warning: DATABASE_URL appears to be using default/placeholder values"
    echo "Please update .env with your actual database credentials"
fi

echo "📦 Generating Prisma client..."
npm run prisma:generate

echo "🗄️  Running database migrations..."
npm run prisma:migrate

echo "✅ Setup complete! You can now run 'npm run dev' to start the server."


