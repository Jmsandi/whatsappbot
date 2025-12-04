#!/bin/bash

# Database Sync Diagnostic Script
# Run this to check if the bot is correctly syncing to Supabase

echo "🔍 WhatsApp Bot Database Sync Diagnostics"
echo "=========================================="
echo ""

# Check 1: Bot running?
echo "📍 Check 1: Is the bot running?"
BOT_RUNNING=$(ps aux | grep -i "node.*dev" | grep -v grep | wc -l)
if [ "$BOT_RUNNING" -gt 0 ]; then
    echo "✅ Bot is running"
else
    echo "❌ Bot is NOT running"
    echo "   Start with: npm run dev"
    echo ""
fi

# Check 2: Environment variables
echo ""
echo "📍 Check 2: Environment Configuration"
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    
    # Check for Supabase vars (without revealing values)
    if grep -q "SUPABASE_URL=" .env; then
        SUPABASE_URL=$(grep "SUPABASE_URL=" .env | cut -d'=' -f2)
        if [ -n "$SUPABASE_URL" ]; then
            echo "✅ SUPABASE_URL is set"
        else
            echo "❌ SUPABASE_URL is empty"
        fi
    else
        echo "❌ SUPABASE_URL not found in .env"
    fi
    
    if grep -q "SUPABASE_SERVICE_ROLE_KEY=" .env; then
        SUPABASE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY=" .env | cut -d'=' -f2)
        if [ -n "$SUPABASE_KEY" ]; then
            echo "✅ SUPABASE_SERVICE_ROLE_KEY is set"
        else
            echo "❌ SUPABASE_SERVICE_ROLE_KEY is empty"
        fi
    else
        echo "❌ SUPABASE_SERVICE_ROLE_KEY not found in .env"
    fi
else
    echo "❌ .env file not found!"
    echo "   Copy from .env.example: cp .env.example .env"
fi

# Check 3: Check recent logs for database messages
echo ""
echo "📍 Check 3: Recent Database Activity (if bot is running)"
if [ "$BOT_RUNNING" -gt 0 ]; then
    echo "Looking for database-related logs..."
    echo "(If bot just started, logs may be limited)"
else
    echo "⚠️  Bot not running - can't check logs"
    echo "   Start the bot and check terminal output for:"
    echo "   - '✓ Supabase connection successful'"
    echo "   - 'Database sync failed' (errors)"
    echo "   - 'Failed to store message' (errors)"
fi

# Check 4: Test Supabase connection (if deps installed)
echo ""
echo "📍 Check 4: Can we connect to Supabase?"
if command -v npx &> /dev/null; then
    echo "Attempting to verify Supabase connection..."
    echo "(This requires your bot to be configured)"
else
    echo "⚠️  npx not available, skipping connection test"
fi

echo ""
echo "=========================================="
echo "📋 Summary & Next Steps:"
echo ""

if [ "$BOT_RUNNING" -eq 0 ]; then
    echo "1. ❌ START THE BOT FIRST"
    echo "   Run: npm run dev"
    echo ""
fi

echo "2. Check bot startup logs for:"
echo "   ✓ 'Supabase connection successful' (if missing, check .env)"
echo "   ✓ 'API server started on port 3001'"
echo "   ✓ 'Supabase Integration: Enabled'"
echo ""

echo "3. Send a WhatsApp message and watch for these logs:"
echo "   - 'Handling message from...'"
echo "   - Check for any 'Database sync failed' errors"
echo "   - Check for any 'Failed to store' errors"
echo ""

echo "4. Check Supabase Dashboard:"
echo "   - Go to: https://app.supabase.com"
echo "   - Table Editor → Check 'users' table"
echo "   - Table Editor → Check 'messages' table"
echo ""

echo "5. Common Issues:"
echo "   ❗ Wrong SUPABASE_URL or KEY - check .env"
echo "   ❗ SQL migration not run - check Supabase tables exist"
echo "   ❗ Bot not running - start with npm run dev"
echo "   ❗ Network/firewall blocking Supabase connection"
echo ""

echo "📝 For detailed help, see: INTEGRATION_SETUP.md"
echo ""
