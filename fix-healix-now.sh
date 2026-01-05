#!/bin/bash
echo "🔧 Fixing Healix Error"
echo "====================="
echo ""

echo "Step 1: Applying database migration..."
npx prisma migrate deploy

echo ""
echo "Step 2: Generating Prisma client..."
npx prisma generate

echo ""
echo "✅ Done! Now:"
echo "1. Restart your dev server (Ctrl+C, then: npm run dev)"
echo "2. Refresh your browser"
echo "3. Try Healix again!"
echo ""

