#!/bin/bash

# Integration Test Script
# Tests the connection between bot API and dashboard

echo "🧪 Testing WhatsApp Bot + Dashboard Integration"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_KEY=${1:-"your-admin-secret-here"}
BOT_URL="http://localhost:3001"

echo "Using API Key: ${API_KEY:0:20}..."
echo "Bot URL: $BOT_URL"
echo ""

# Test 1: Health Check
echo "📍 Test 1: Health Check"
response=$(curl -s -w "\n%{http_code}" $BOT_URL/health)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Bot is responding"
else
    echo -e "${RED}❌ FAIL${NC} - Bot is not responding (HTTP $http_code)"
    echo "Make sure the bot is running: npm run dev"
    exit 1
fi
echo ""

# Test 2: Bot Status (requires auth)
echo "📍 Test 2: Bot Status (Authenticated)"
response=$(curl -s -w "\n%{http_code}" -H "X-API-Key: $API_KEY" $BOT_URL/status)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} - API authentication working"
    echo "Response: $body" | head -c 100
    echo "..."
elif [ "$http_code" = "401" ]; then
    echo -e "${RED}❌ FAIL${NC} - Authentication failed"
    echo "Check that ADMIN_API_KEY in bot .env matches NEXT_PUBLIC_BOT_API_KEY in dashboard .env"
    exit 1
else
    echo -e "${RED}❌ FAIL${NC} - Unexpected response (HTTP $http_code)"
    exit 1
fi
echo ""

# Test 3: Analytics Endpoint
echo "📍 Test 3: Analytics API"
response=$(curl -s -w "\n%{http_code}" -H "X-API-Key: $API_KEY" $BOT_URL/api/analytics/stats)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Analytics endpoint working"
    if echo "$body" | grep -q "success"; then
        echo "Response includes 'success' field"
    fi
elif [ "$http_code" = "500" ]; then
    echo -e "${YELLOW}⚠️  PARTIAL${NC} - Endpoint exists but database might not be set up"
    echo "Have you run the SQL migration script on Supabase?"
else
    echo -e "${RED}❌ FAIL${NC} - Analytics endpoint failed (HTTP $http_code)"
fi
echo ""

# Test 4: CORS Headers
echo "📍 Test 4: CORS Configuration"
response=$(curl -s -I -H "Origin: http://localhost:3000" -H "X-API-Key: $API_KEY" $BOT_URL/status)

if echo "$response" | grep -qi "access-control-allow-origin"; then
    echo -e "${GREEN}✅ PASS${NC} - CORS headers present"
    echo "$response" | grep -i "access-control"
else
    echo -e "${RED}❌ FAIL${NC} - CORS not configured"
    echo "Dashboard may not be able to access bot API"
fi
echo ""

# Test 5: Database Connection
echo "📍 Test 5: Database Connection"
response=$(curl -s -w "\n%{http_code}" -H "X-API-Key: $API_KEY" $BOT_URL/api/users)
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Database is accessible"
elif [ "$http_code" = "500" ]; then
    echo -e "${RED}❌ FAIL${NC} - Database connection failed"
    echo "Check Supabase credentials in bot .env"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Unexpected response (HTTP $http_code)"
fi
echo ""

echo "=============================================="
echo "Test Summary:"
echo "  Check that all 5 tests pass ✅"
echo "" 
echo "Next Steps:"
echo "  1. If database tests fail, run SQL migration"
echo "  2. Send a WhatsApp message to the bot"
echo "  3. Open dashboard and check Users page"
echo ""
