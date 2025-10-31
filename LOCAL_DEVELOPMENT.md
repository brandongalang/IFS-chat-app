# Local Development Guide

This guide shows you how to run the **complete IFS app locally** with full authentication, database, and chat functionality - no deployment needed!

## The Problem We're Solving

**Current pain point:**
```
Dev mode → No auth → No userId → Chat doesn't work → Can't test anything → Must deploy to Vercel
```

**Solution:**
```
Docker Compose → Local Supabase → Real auth → Real userId → Everything works → Test locally!
```

---

## Quick Start (5 Minutes)

### 1. Start Local Supabase

```bash
# Start all services (PostgreSQL, Auth, Storage, Studio, etc.)
docker-compose up -d

# Wait ~30 seconds for services to start
# Check status:
docker-compose ps
```

**Services available:**
- **Supabase Studio** (DB admin UI): http://localhost:54323
- **API Gateway**: http://localhost:54321
- **PostgreSQL**: localhost:54322
- **Email testing** (Inbucket): http://localhost:54324

### 2. Configure Environment

Create `.env.local`:

```bash
cat > .env.local << 'EOF'
# ============================================================================
# LOCAL SUPABASE (Docker Compose)
# ============================================================================
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Demo Auth (creates test user in local DB)
IFS_DEMO_AUTH_ENABLED=true
NEXT_PUBLIC_IFS_DEMO_AUTH_ENABLED=true
IFS_DEMO_AUTH_EMAIL=demo@local.dev
IFS_DEMO_AUTH_PASSWORD=demo123

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
BASE_URL=http://localhost:3000

# AI Model (required for chat)
OPENROUTER_API_KEY=your-key-here
IFS_CHAT_MODEL=google/gemini-2.5-flash-preview-09-2025
IFS_AGENT_MODEL=google/gemini-2.5-flash-lite-preview-09-2025

# Feature Flags
IFS_INBOX=true
NEXT_PUBLIC_IFS_INBOX=true
ENABLE_GARDEN=true
NEXT_PUBLIC_ENABLE_GARDEN=true

# IMPORTANT: Disable dev mode to test real auth
IFS_DEV_MODE=false
NEXT_PUBLIC_IFS_DEV_MODE=false
EOF
```

### 3. Run Database Migrations

```bash
# Install Supabase CLI if needed
brew install supabase/tap/supabase
# or: npm install -g supabase

# Link to local instance
supabase link --project-ref local

# Run migrations
supabase db push
```

### 4. Start Next.js

```bash
npm install
npm run dev
```

### 5. Login with Demo User

1. Navigate to http://localhost:3000
2. You'll be redirected to http://localhost:3000/auth/login
3. Click **"Demo Login"** button
4. You're now logged in with a **real user session**!

### 6. Test Everything

Now you can:
- ✅ **Chat** - Full chat functionality with userId
- ✅ **Session persistence** - Real sessions with memory
- ✅ **Insights** - Generated and stored in local DB
- ✅ **Inbox** - Observation generation works
- ✅ **Garden** - Part tracking with database
- ✅ **Onboarding** - Complete onboarding flow

**Everything works exactly like production!**

---

## Development Workflows

### Option 1: Full E2E Testing (Recommended)

**Use case:** Testing features that need auth/database/chat

```bash
# Terminal 1: Start Supabase
docker-compose up -d

# Terminal 2: Start Next.js
npm run dev

# Access app at http://localhost:3000
# Use demo login to test with real session
```

**When to use:**
- Testing chat functionality
- Testing insights/inbox generation
- Testing session/memory features
- Before deploying to production

### Option 2: Quick UI Work (Dev Mode)

**Use case:** Testing UI changes that don't need database

```bash
# .env.local
IFS_DEV_MODE=true
NEXT_PUBLIC_IFS_DEV_MODE=true
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""

npm run dev:flow
```

**When to use:**
- UI component development
- Styling/layout changes
- Quick iterations without database

### Option 3: Production Supabase (Remote Testing)

**Use case:** Testing against staging/production database

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-real-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-real-service-key
IFS_DEV_MODE=false

npm run dev
```

**When to use:**
- Testing with production data
- Debugging production issues locally

---

## Managing Local Supabase

### View Database in Studio

Open http://localhost:54323

- **Table Editor**: Browse/edit data
- **SQL Editor**: Run queries
- **Database** tab: View schema
- **Auth** tab: View users

### View Test Emails

Open http://localhost:54324

All auth emails (password resets, confirmations) appear here instead of real email.

### Access PostgreSQL Directly

```bash
# Connect with psql
psql postgres://postgres:postgres@localhost:54322/postgres

# Or use any SQL client:
# Host: localhost
# Port: 54322
# User: postgres
# Pass: postgres
# DB: postgres
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f db
docker-compose logs -f auth
docker-compose logs -f kong
```

### Reset Database

```bash
# Stop containers and delete volumes
docker-compose down -v

# Restart and re-run migrations
docker-compose up -d
supabase db push
```

### Stop Services

```bash
# Stop but keep data
docker-compose stop

# Stop and remove containers (keeps volumes/data)
docker-compose down

# Stop and delete everything (fresh start)
docker-compose down -v
```

---

## Troubleshooting

### "Port already in use"

```bash
# Find what's using the port
lsof -i :54321  # or :54322, :54323, etc.

# Kill the process or stop conflicting service
# Then restart Docker Compose
```

### Migrations won't run

```bash
# Check if DB is healthy
docker-compose ps

# View DB logs
docker-compose logs db

# Reset and retry
docker-compose down -v
docker-compose up -d
supabase db push
```

### Can't connect to Supabase

```bash
# Check services are running
docker-compose ps

# Should show "Up" for all services:
# - ifs-supabase-db
# - ifs-supabase-kong
# - ifs-supabase-auth
# - ifs-supabase-studio
# - etc.

# Check Kong gateway
curl http://localhost:54321/rest/v1/
# Should return auth error (expected without token)
```

### Demo login doesn't work

```bash
# Check auth service logs
docker-compose logs auth

# Verify env vars in .env.local
grep DEMO .env.local

# Should show:
# IFS_DEMO_AUTH_ENABLED=true
# NEXT_PUBLIC_IFS_DEMO_AUTH_ENABLED=true
# IFS_DEMO_AUTH_EMAIL=demo@local.dev
# IFS_DEMO_AUTH_PASSWORD=demo123
```

### Chat returns 401 Unauthorized

This means dev mode is still enabled:

```bash
# Check .env.local
grep IFS_DEV_MODE .env.local

# Should be:
# IFS_DEV_MODE=false
# NEXT_PUBLIC_IFS_DEV_MODE=false

# Restart Next.js after changing
```

---

## Testing Strategies

### Unit Tests

```bash
# Fast tests without database
npm run test:unit
```

**What it tests:**
- Business logic
- Data transformations
- Utility functions
- Schema validation

**Uses:** Test doubles via `setXXXOverrideForTests()`

### Integration Tests

```bash
# API route tests with mocked Supabase
npm run test:integration
```

**What it tests:**
- API routes
- Database interactions (mocked)
- Auth flows (mocked)

**Uses:** Supabase client mocks

### E2E Tests with Playwright

```bash
# Requires local Supabase running!
docker-compose up -d

# Run E2E tests
npm run test:e2e

# Or with UI (debugging)
npm run test:e2e:headed
```

**What it tests:**
- Full user flows
- Auth + database + UI
- Real browser interactions

**Uses:** Real local Supabase instance

### Manual Testing

```bash
# Start local Supabase
docker-compose up -d

# Start app
npm run dev

# Test in browser:
# 1. Login with demo user
# 2. Start chat session
# 3. Verify data in Studio (http://localhost:54323)
# 4. Check inbox generation
# 5. Test insights
```

---

## Best Practices

### 1. Use Docker Compose for E2E Testing

**Before deploying:**
```bash
docker-compose up -d
npm run dev
# Test full user flow with demo login
# Verify chat, insights, inbox work correctly
```

### 2. Use Dev Mode for Quick UI Iteration

**When changing styles/components:**
```bash
# .env.local: IFS_DEV_MODE=true
npm run dev:flow
# No need for Supabase to be running
```

### 3. Keep Local DB Fresh

```bash
# Weekly (or when schema changes significantly):
docker-compose down -v
docker-compose up -d
supabase db push
```

### 4. Verify Migration Changes Locally

```bash
# After creating new migration:
supabase db push  # Apply to local DB
npm run dev       # Test locally
# Only deploy to production after local validation
```

### 5. Use Studio to Debug Data

When something doesn't work:
1. Open http://localhost:54323
2. Check **Auth** tab for user session
3. Check **Table Editor** for expected data
4. Run queries in **SQL Editor** to investigate

---

## Environment Variables Cheat Sheet

| Variable | Local Docker | Dev Mode | Production |
|----------|--------------|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://localhost:54321` | `""` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Docker default JWT | `""` | Real service key |
| `IFS_DEV_MODE` | `false` | `true` | `false` |
| `NEXT_PUBLIC_IFS_DEV_MODE` | `false` | `true` | `false` |
| `IFS_DEMO_AUTH_ENABLED` | `true` | `true` | `false` (optional) |
| `OPENROUTER_API_KEY` | Required | Required | Required |

---

## Next Steps

### For Your Coding Agent

Now that you have local Supabase:

1. **Test changes locally before deploy**
   ```bash
   docker-compose up -d
   npm run dev
   # Agent can verify changes work E2E
   ```

2. **Better logging/debugging**
   ```bash
   # Enable verbose logging
   IFS_VERBOSE=true npm run dev

   # Check logs in real-time
   docker-compose logs -f
   ```

3. **Faster iteration**
   - No need to deploy to Vercel to test chat
   - Verify database changes in Studio
   - Test insights/inbox generation locally

### For Better Testing Coverage

1. **Add Playwright auth fixture**
   - Reuse demo login across tests
   - Faster E2E test execution

2. **Create test data fixtures**
   - Seed common scenarios (beginner/advanced personas)
   - Snapshot test data for regression testing

3. **Improve integration tests**
   - Test against real local DB instead of mocks
   - More confidence in database interactions

---

## Summary

**You now have THREE development modes:**

1. **🚀 Dev Mode** (fastest - no auth)
   - `IFS_DEV_MODE=true`
   - No Supabase needed
   - For UI work only

2. **🔧 Local Supabase** (recommended - full E2E)
   - `docker-compose up -d`
   - Complete local stack
   - Test everything before deploy

3. **☁️ Remote Supabase** (production testing)
   - Point to real Supabase
   - Test with production data
   - Debug production issues

**Use #2 (Local Supabase) for testing chat and end-to-end flows** - it solves your main pain point!
