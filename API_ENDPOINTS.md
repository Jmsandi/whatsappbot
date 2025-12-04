# New API Endpoints Added to Bot

All endpoints require admin authentication via `X-API-Key` header or `Authorization: Bearer <key>` header.

## Analytics Endpoints

### GET /api/analytics/stats
Get dashboard statistics
```json
{
  "success": true,
  "stats": {
    "totalUsers": 150,
    "activeUsers": 120,
    "totalMessages": 5234,
    "todayMessages": 234
  }
}
```

### GET /api/analytics/intents/distribution
Get top intents by usage
```json
{
  "success": true,
  "intents": [
    { "intent": "greeting", "count": 1245 },
    { "intent": "faq", "count": 892 }
  ]
}
```

## User Management Endpoints

### GET /api/users?status=active&search=john&limit=100&offset=0
List users with optional filters
```json
{
  "success": true,
  "users": [...],
  "total": 150
}
```

### GET /api/users/:id
Get user details

### PUT /api/users/:id
Update user (status, tags, name)
```json
{
  "status": "banned",
  "tags": ["VIP", "Staff"],
  "name": "John Doe"
}
```

### GET /api/users/:id/messages?limit=50
Get user conversation history

## Message Endpoints

### GET /api/messages?sender=user&search=hello&limit=100&offset=0
List all messages with filters
```json
{
  "success": true,
  "messages": [...],
  "total": 5234
}
```

## Broadcast Endpoints

### POST /api/broadcast
Send broadcast message to users
```json
{
  "title": "Holiday Promotion",
  "message": "Happy holidays! 🎄",
  "target": "All Users" // or "Active Users", "VIP Only"
}
```

Response:
```json
{
  "success": true,
  "broadcast": {
    "id": "...",
    "target_count": 150,
    "delivered_count": 148,
    "status": "sent"
  }
}
```

### GET /api/broadcast/history?limit=50
Get broadcast history

## Settings Endpoints

### GET /api/settings
Get all bot settings
```json
{
  "success": true,
  "settings": {
    "welcome_message": "Hello!",
    "ai_model": "gpt-4",
    ...
  }
}
```

### PUT /api/settings
Update bot settings
```json
{
  "settings": {
    "welcome_message": "Hi there!",
    "ai_temperature": "0.7"
  }
}
```

## Contacts Endpoints

### GET /api/contacts
List special contacts

### POST /api/contacts
Add special contact
```json
{
  "name": "Dr. Smith",
  "phone": "+1234567890",
  "email": "[email protected]",
  "role": "Health Worker"
}
```

### PUT /api/contacts/:id
Update contact

### DELETE /api/contacts/:id
Delete contact

## Testing

Test the endpoints:
```bash
# Set your admin API key
API_KEY="your-admin-secret-here"

# Test analytics
curl -H "X-API-Key: $API_KEY" http://localhost:3001/api/analytics/stats

# Test users list
curl -H "X-API-Key: $API_KEY" http://localhost:3001/api/users

# Test broadcast (change phone to test number)
curl -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"title":"Test","message":"Hello from API","target":"All Users"}' \
  http://localhost:3001/api/broadcast
```
