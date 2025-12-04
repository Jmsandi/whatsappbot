# 🚀 Quick Start Checklist

Use this checklist to get your integration up and running quickly!

## ✅ Pre-Setup (Already Done!)

- [x] Bot port changed to 3001
- [x] Supabase client added to bot
- [x] API endpoints created (15+)
- [x] Bot API client created for dashboard
- [x] CORS configured
- [x] Dashboard `.env` updated with bot API config

## 📋 Configuration Steps (Do These Now!)

### 1. Configure Bot Environment

- [ ] Navigate to bot directory:
  ```bash
  cd /Users/jmsandi/Documents/whatsapp\ chat/whatsapp-geneline-bridge
  ```

- [ ] Run setup script OR manually edit `.env`:
  ```bash
  # Option A: Quick setup (recommended)
  ./setup.sh

  # Option B: Manual setup
  cp .env.example .env
  nano .env
  ```

- [ ] Add these required values to `.env`:
  ```bash
  # Geneline-X (if you have these)
  GENELINE_HOST=https://message.geneline-x.net
  GENELINE_API_KEY=your-geneline-api-key
  GENELINE_CHATBOT_ID=your-chatbot-id

  # Supabase (already configured if you ran setup script)
  SUPABASE_URL=https://xzosstwufrjqrredojon.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

  # Admin API Key (create a secure random string)
  ADMIN_API_KEY=my-super-secret-admin-key-123
  ```

- [ ] Update dashboard `.env` with the SAME admin key:
  ```bash
  cd /Users/jmsandi/Documents/whatsapp\ chat/admin/v0-admin-dashboard-build
  nano .env
  
  # Make sure this matches bot's ADMIN_API_KEY:
  NEXT_PUBLIC_BOT_API_KEY=my-super-secret-admin-key-123
  ```

### 2. Set Up Database

- [ ] Go to [Supabase Dashboard](https://app.supabase.com)
- [ ] Select project: `xzosstwufrjqrredojon`
- [ ] Navigate to: **SQL Editor**
- [ ] Copy contents of: `admin/v0-admin-dashboard-build/scripts/001_create_tables.sql`
- [ ] Paste and **Run** the SQL script
- [ ] ✅ Verify: You should see Tables created successfully

### 3. Start Services

- [ ] **Terminal 1** - Start WhatsApp Bot:
  ```bash
  cd /Users/jmsandi/Documents/whatsapp\ chat/whatsapp-geneline-bridge
  npm install  # if you haven't already
  npm run dev
  ```
  
  Expected output:
  ```
  ✓ Supabase connection successful
  API server started on port 3001
  WhatsApp client initialized
  Supabase Integration: Enabled
  ```

- [ ] **Terminal 2** - Start Admin Dashboard:
  ```bash
  cd /Users/jmsandi/Documents/whatsapp\ chat/admin/v0-admin-dashboard-build
  npm run dev
  ```
  
  Dashboard at: http://localhost:3000

## 🧪 Testing

### Test 1: API Connection

- [ ] Run integration test:
  ```bash
  cd /Users/jmsandi/Documents/whatsapp\ chat/whatsapp-geneline-bridge
  ./test-integration.sh my-super-secret-admin-key-123
  ```

- [ ] All 5 tests should PASS ✅

### Test 2: WhatsApp → Database Sync

- [ ] Send a WhatsApp message to your bot
- [ ] Check bot terminal for database sync logs
- [ ] Open dashboard: http://localhost:3000
- [ ] Navigate to **Users** page
- [ ] ✅ Your user should appear!
- [ ] Navigate to **Messages** page  
- [ ] ✅ Your conversation should be there!

### Test 3: Dashboard → Bot API

- [ ] Open browser console (F12)
- [ ] Navigate to different dashboard pages
- [ ] ✅ No CORS errors should appear
- [ ] ✅ Data loads successfully

### Test 4: Broadcast Feature (Optional)

- [ ] Go to dashboard **Broadcast** page
- [ ] Try creating a test broadcast
- [ ] ✅ It should send via WhatsApp

## 🐛 Troubleshooting

### Problem: "Supabase connection failed"
**Solution:**
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in bot's `.env`
- Verify you ran the SQL migration
- Make sure Supabase project is not paused

### Problem: "API authentication failed" (401)
**Solution:**
- Check that `ADMIN_API_KEY` in bot `.env` matches `NEXT_PUBLIC_BOT_API_KEY` in dashboard `.env`
- They must be exactly the same!

### Problem: "Port already in use"
**Solution:**
```bash
# Kill processes on those ports
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Problem: Dashboard can't reach bot API
**Solution:**
- Verify bot is running on port 3001
- Check browser console for errors
- Run `./test-integration.sh` to diagnose

### Problem: No data in dashboard
**Solution:**
- Send a WhatsApp message first
- Check bot logs for sync errors
- Verify SQL migration ran successfully

## 📚 Documentation

- **Full Setup Guide**: `INTEGRATION_SETUP.md`
- **API Reference**: `API_ENDPOINTS.md`
- **Project Walkthrough**: `.gemini/antigravity/brain/.../walkthrough.md`

## ✨ Success Indicators

You're all set when:
- ✅ Bot starts with "Supabase Integration: Enabled"
- ✅ Dashboard loads at http://localhost:3000
- ✅ WhatsApp messages appear in dashboard
- ✅ Test script shows all PASS
- ✅ No errors in browser console

**Next:** Start sending WhatsApp messages and managing your bot through the beautiful admin dashboard! 🎉
