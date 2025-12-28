#!/bin/bash

echo "🔍 Checking setup status..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    exit 1
fi

echo "✅ .env file exists"

# Check if DATABASE_URL is set (not the placeholder)
DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2- | tr -d '"')
if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" == "postgresql://user:password@localhost:5432/medical_crm?schema=public" ]; then
    echo "⏳ DATABASE_URL needs to be configured"
    echo ""
    echo "Please:"
    echo "1. Get a database connection string from:"
    echo "   - Supabase (free): https://supabase.com"
    echo "   - Railway: https://railway.app"
    echo "   - Neon: https://neon.tech"
    echo ""
    echo "2. Update DATABASE_URL in .env file"
    echo ""
    echo "3. Run this script again"
    exit 1
fi

echo "✅ DATABASE_URL is configured"
echo ""

# Check if NEXTAUTH_SECRET is set
SECRET=$(grep "^NEXTAUTH_SECRET=" .env | cut -d '=' -f2- | tr -d '"')
if [ -z "$SECRET" ] || [ "$SECRET" == "your-secret-key-here-change-in-production" ]; then
    echo "❌ NEXTAUTH_SECRET needs to be generated"
    exit 1
fi

echo "✅ NEXTAUTH_SECRET is set"
echo ""
echo "🚀 Ready to continue! Next steps:"
echo ""
echo "1. Run migrations:"
echo "   npm run db:migrate"
echo ""
echo "2. Seed database:"
echo "   npm run db:seed"
echo ""
echo "3. Start dev server:"
echo "   npm run dev"
echo ""

