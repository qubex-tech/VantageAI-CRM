#!/bin/bash
echo "🔍 Debugging Healix Error"
echo "========================"
echo ""

echo "1. Checking environment variables..."
if grep -q "OPENAI_API_KEY" .env; then
    echo "   ✅ OPENAI_API_KEY found"
    KEY_LENGTH=$(grep "OPENAI_API_KEY" .env | cut -d'=' -f2 | wc -c)
    echo "   Key length: $KEY_LENGTH characters"
else
    echo "   ❌ OPENAI_API_KEY NOT found in .env"
fi

echo ""
echo "2. Checking database tables..."
echo "   Run this SQL to check:"
echo "   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'healix%';"
echo ""
echo "   Or use: npx prisma studio"
echo ""

echo "3. Checking Prisma client..."
if [ -d "node_modules/@prisma/client" ]; then
    echo "   ✅ Prisma client exists"
else
    echo "   ❌ Prisma client missing - run: npx prisma generate"
fi

echo ""
echo "4. Next steps:"
echo "   - Check server terminal for error logs"
echo "   - Check browser console (F12) for errors"
echo "   - Check browser Network tab → /api/healix/chat → Response"
echo ""

