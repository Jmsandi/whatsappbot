#!/bin/bash

# Quick Setup Script for WhatsApp Bot + Admin Dashboard Integration
# This script helps you configure both services quickly

echo "🚀 WhatsApp Bot + Admin Dashboard Integration Setup"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the whatsapp-geneline-bridge directory"
    exit 1
fi

echo "📋 Step 1: Creating bot .env file..."
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists. Creating backup..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy from example
cp .env.example .env

echo "✅ .env file created from .env.example"
echo ""

echo "📝 Step 2: You need to configure these values in .env:"
echo ""
echo "Required for Geneline-X:"
echo "  - GENELINE_HOST (your Geneline-X API host)"
echo "  - GENELINE_API_KEY (your API key)"
echo "  - GENELINE_CHATBOT_ID (your chatbot ID)"
echo ""
echo "Required for Supabase (get from https://app.supabase.com):"
echo "  - SUPABASE_URL=https://xzosstwufrjqrredojon.supabase.co"
echo "  - SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6b3NzdHd1ZnJqcXJyZWRvam9uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4MzkyMywiZXhwIjoyMDgwMzU5OTIzfQ.-rveCAbfpjaYU4oBbLYqguXeJVg5_xcI2v4YA2v1WQU"
echo ""
echo "Required for Admin API:"  
echo "  - ADMIN_API_KEY (create a secure random key)"
echo ""

echo "💡 Tip: Use the same Supabase project as your admin dashboard!"
echo ""

# Offer to auto-configure Supabase
read -p "Would you like to auto-configure Supabase with the dashboard's credentials? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Update .env with Supabase credentials
    sed -i.bak 's|SUPABASE_URL=.*|SUPABASE_URL=https://xzosstwufrjqrredojon.supabase.co|' .env
    sed -i.bak 's|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6b3NzdHd1ZnJqcXJyZWRvam9uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4MzkyMywiZXhwIjoyMDgwMzU5OTIzfQ.-rveCAbfpjaYU4oBbLYqguXeJVg5_xcI2v4YA2v1WQU|' .env
    rm .env.bak
    echo "✅ Supabase credentials configured!"
fi

echo ""
echo "📋 Step 3: Database Setup"
echo "  1. Go to https://app.supabase.com"
echo "  2. Open your project: xzosstwufrjqrredojon"
echo "  3. Navigate to SQL Editor"
echo "  4. Run: ../admin/v0-admin-dashboard-build/scripts/001_create_tables.sql"
echo ""

echo "📋 Step 4: Install dependencies & start bot"
echo "  Run: npm install && npm run dev"
echo ""

echo "📋 Step 5: Start admin dashboard (in separate terminal)"
echo "  cd ../admin/v0-admin-dashboard-build && npm run dev"
echo ""

echo "✅ Setup guide complete!"
echo ""
echo "📚 For detailed instructions, see: INTEGRATION_SETUP.md"
echo ""
