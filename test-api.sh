#!/bin/bash

# WhatsApp-Geneline Bridge API Test Script
# This script tests all available API endpoints

BASE_URL="http://localhost:3000"
ADMIN_API_KEY="cb87efb495bcfcf11f466455782a2d997cc24e36474f7edf5e402d4be926fac8"

echo "======================================"
echo "WhatsApp-Geneline Bridge API Tests"
echo "======================================"
echo ""

# Test 1: Health Check
echo "1. Testing /health endpoint..."
curl -s "$BASE_URL/health" | jq '.'
echo ""
echo ""

# Test 2: Status Check
echo "2. Testing /status endpoint..."
curl -s "$BASE_URL/status" | jq '.'
echo ""
echo ""

# Test 3: Admin - Get Queue Stats
echo "3. Testing /admin/queue/stats endpoint..."
curl -s -H "X-Admin-API-Key: $ADMIN_API_KEY" "$BASE_URL/admin/queue/stats" | jq '.'
echo ""
echo ""

# Test 4: Admin - Get Active Chats
echo "4. Testing /admin/chats endpoint..."
curl -s -H "X-Admin-API-Key: $ADMIN_API_KEY" "$BASE_URL/admin/chats" | jq '.'
echo ""
echo ""

# Test 5: Admin - Get WhatsApp Info
echo "5. Testing /admin/whatsapp/info endpoint..."
curl -s -H "X-Admin-API-Key: $ADMIN_API_KEY" "$BASE_URL/admin/whatsapp/info" | jq '.'
echo ""
echo ""

echo "======================================"
echo "All tests completed!"
echo "======================================"
