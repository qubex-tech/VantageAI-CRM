#!/bin/bash
echo "🔍 Checking Healix Setup..."
echo "============================"
echo ""

# Check OpenAI key
if grep -q "OPENAI_API_KEY" .env 2>/dev/null; then
    echo "✅ OPENAI_API_KEY found in .env"
else
    echo "❌ OPENAI_API_KEY NOT found in .env"
fi

# Check Prisma client
if [ -d "node_modules/@prisma/client" ]; then
    echo "✅ Prisma client generated"
else
    echo "❌ Prisma client not generated - run: npx prisma generate"
fi

# Check migration file exists
if [ -f "prisma/migrations/20250105000000_add_healix_models/migration.sql" ]; then
    echo "✅ Migration file exists"
else
    echo "❌ Migration file not found"
fi

# Check if tables might exist (via Prisma)
echo ""
echo "📊 Checking database..."
echo "Run this SQL to check if tables exist:"
echo ""
echo "SELECT table_name FROM information_schema.tables"
echo "WHERE table_schema = 'public' AND table_name LIKE 'healix%';"
echo ""
echo "Or use: npx prisma studio"
echo ""

echo "💡 If tables don't exist, run:"
echo "   npx prisma migrate deploy"
echo ""
