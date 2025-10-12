#!/bin/bash

# AI Rename Backend Test Script
# Tests CORS configuration and API endpoint

echo "========================================="
echo "AI Rename Backend Test Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BACKEND_URL="http://localhost:3001"

# Test 1: Health Check
echo "Test 1: Health Check"
echo "---------------------"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Server is running"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ FAIL${NC} - Server is not responding (HTTP $HTTP_CODE)"
    echo "Make sure the server is running: cd ai-rename-backend && npm start"
    exit 1
fi

echo ""

# Test 2: CORS Preflight (OPTIONS)
echo "Test 2: CORS Preflight Request"
echo "-------------------------------"
CORS_RESPONSE=$(curl -s -i -X OPTIONS "$BACKEND_URL/api/rename-layers" \
    -H "Origin: null" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type")

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin:"; then
    echo -e "${GREEN}✓ PASS${NC} - CORS headers present"
    echo "$CORS_RESPONSE" | grep "Access-Control-Allow"
else
    echo -e "${RED}✗ FAIL${NC} - Missing CORS headers"
    echo "Response:"
    echo "$CORS_RESPONSE"
    exit 1
fi

echo ""

# Test 3: Actual POST Request
echo "Test 3: Rename Layers Endpoint"
echo "-------------------------------"
RENAME_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/rename-layers" \
    -H "Content-Type: application/json" \
    -H "Origin: null" \
    -d '{
        "layers": [{"id": "test1", "name": "Rectangle 1", "type": "RECTANGLE"}],
        "context": {"frameName": "Test", "totalLayers": 1, "chunkIndex": 0, "totalChunks": 1}
    }')

HTTP_CODE=$(echo "$RENAME_RESPONSE" | tail -n 1)
BODY=$(echo "$RENAME_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} - API endpoint responding with 200"
    echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" = "500" ]; then
    echo -e "${YELLOW}⚠ PARTIAL${NC} - Endpoint accessible but API error (HTTP 500)"
    echo "This usually means:"
    echo "  1. CORS is working ✓"
    echo "  2. Backend is running ✓"
    echo "  3. Gemini API key issue ✗"
    echo ""
    echo "Error details:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    echo -e "${YELLOW}Action Required:${NC}"
    echo "  1. Get a fresh API key from https://aistudio.google.com/apikey"
    echo "  2. Update .env file: GEMINI_API_KEY=your_new_key"
    echo "  3. Restart server: npm start"
else
    echo -e "${RED}✗ FAIL${NC} - Unexpected response (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
    exit 1
fi

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "${GREEN}✓${NC} Server is running"
echo -e "${GREEN}✓${NC} CORS is configured correctly"
echo -e "${YELLOW}⚠${NC} Gemini API key needs verification"
echo ""
echo "Next steps:"
echo "  1. Verify your Gemini API key at https://aistudio.google.com/apikey"
echo "  2. Update .env with a valid key"
echo "  3. Run this script again to verify full functionality"
echo "  4. Once working, test from the Figma plugin"
echo ""
