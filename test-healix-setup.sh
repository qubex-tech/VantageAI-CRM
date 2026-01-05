#!/bin/bash
set -e

echo "🔧 Healix Test Setup Script"
echo "============================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create a .env file with your environment variables"
    exit 1
fi

# Check for OPENAI_API_KEY
if ! grep -q "OPENAI_API_KEY" .env; then
    echo "⚠️  OPENAI_API_KEY not found in .env"
    echo "Please add: OPENAI_API_KEY=your_key_here"
    echo ""
fi

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Check migration status
echo ""
echo "📊 Checking migration status..."
MIGRATION_STATUS=$(npx prisma migrate status 2>&1 | grep -i "not yet been applied" || echo "")

if [ ! -z "$MIGRATION_STATUS" ]; then
    echo "⚠️  Some migrations not applied:"
    echo "$MIGRATION_STATUS"
    echo ""
    read -p "Run migration now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Running migrations..."
        npx prisma migrate dev --name add_healix_models
    fi
else
    echo "✅ All migrations applied"
fi

# Check for Healix tables
echo ""
echo "🔍 Checking for Healix tables..."
HEALIX_TABLES=$(npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'healix%';" 2>/dev/null || echo "")

if [ ! -z "$HEALIX_TABLES" ]; then
    echo "✅ Healix tables found"
else
    echo "⚠️  Healix tables not found - you may need to run migrations"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure OPENAI_API_KEY is set in .env"
echo "2. Run: npm run dev"
echo "3. Open http://localhost:3000"
echo "4. Click the Healix button in the header (or press Cmd/Ctrl+K)"
echo ""
