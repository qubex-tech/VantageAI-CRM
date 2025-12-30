#!/bin/bash

# Script to update environment variables with new Supabase credentials
# Run this script to update your .env file

cat >> .env.update << 'EOF'
# Updated Supabase credentials - Copy these to your .env file:

NEXT_PUBLIC_SUPABASE_URL=https://twfvatkcekctlmdlasil.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3ZnZhdGtjZWtjdGxtZGxhc2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNjM5MjYsImV4cCI6MjA4MjYzOTkyNn0.dZSGQh0Y6kqcsR9FH-urKnaKiV4y9lAn-oW-rIfuzuc

# Update DATABASE_URL with the new connection string (non-pooling for migrations):
# DATABASE_URL="postgres://postgres.twfvatkcekctlmdlasil:SEKXyLSEjVqbORAV@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
EOF

echo "Environment variables template created in .env.update"
echo "Please manually update your .env file with these values"
echo ""
echo "For Vercel, set these environment variables:"
echo "NEXT_PUBLIC_SUPABASE_URL=https://twfvatkcekctlmdlasil.supabase.co"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3ZnZhdGtjZWtjdGxtZGxhc2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNjM5MjYsImV4cCI6MjA4MjYzOTkyNn0.dZSGQh0Y6kqcsR9FH-urKnaKiV4y9lAn-oW-rIfuzuc"

