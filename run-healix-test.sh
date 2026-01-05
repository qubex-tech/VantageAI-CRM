#!/bin/bash
echo "🚀 Healix Quick Test Script"
echo "============================"
echo ""

# Step 1: Check OpenAI key
if ! grep -q "OPENAI_API_KEY" .env 2>/dev/null; then
    echo "❌ OPENAI_API_KEY not found in .env"
    echo ""
    echo "Please add your OpenAI API key to .env:"
    echo "  OPENAI_API_KEY=sk-your-key-here"
    echo ""
    read -p "Press Enter after adding the key, or Ctrl+C to cancel..."
fi

# Step 2: Run migration
echo "📦 Creating database migration..."
npx prisma migrate dev --name add_healix_models --skip-generate

# Step 3: Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
npx prisma generate

# Step 4: Start dev server
echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. The dev server should start automatically"
echo "2. Open http://localhost:3000"
echo "3. Login to your account"
echo "4. Click the 'Healix' button in the top-right header"
echo "5. Or press Cmd/Ctrl+K to open"
echo ""
echo "📖 See TEST_HEALIX.md for detailed testing instructions"
echo ""
echo "Starting dev server..."
npm run dev
