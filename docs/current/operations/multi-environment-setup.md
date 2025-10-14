---
title: Multi-Environment Supabase Setup
owner: @brandongalang
last_updated: 2025-10-13
related_docs:
  - docs/current/features/parts-garden.md
  - REMOTE_SUPABASE_SETUP.md
related_prs:
  - TBD
---

# Multi-Environment Supabase Setup

## Overview

The application now supports running against both **local** (Docker) and **production** Supabase environments using a single `.env.local` configuration file. Switch between environments using the browser-safe `NEXT_PUBLIC_TARGET_ENV` variable (with `TARGET_ENV` as a server-only fallback).

## Environment Configuration

### .env.local Structure

Keep both local and production credentials in `.env.local`:

```bash
# === LOCAL SUPABASE (Docker) ===
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...local-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...local-service-key

# === PRODUCTION SUPABASE ===
# Used when TARGET_ENV or NEXT_PUBLIC_TARGET_ENV is set to prod
NEXT_PUBLIC_PROD_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_PROD_SUPABASE_ANON_KEY=sb_publishable_...
PROD_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PROD_SUPABASE_ANON_KEY=sb_publishable_...
PROD_SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# === STORAGE CONFIGURATION ===
MEMORY_STORAGE_ADAPTER=supabase  # or 'local' for filesystem

# === USER CONFIGURATION ===
IFS_DEFAULT_USER_ID=11111111-1111-1111-1111-111111111111
```

### Getting Production Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_PROD_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_PROD_SUPABASE_ANON_KEY`
   - **service_role key** → `PROD_SUPABASE_SERVICE_ROLE_KEY` (⚠️ keep secret!)

## Usage

### Running the Application

**Local environment (default):**
```bash
npm run dev
# Uses NEXT_PUBLIC_SUPABASE_URL and local Docker Supabase
```

**Production environment:**
```bash
TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npm run dev
# Uses NEXT_PUBLIC_PROD_SUPABASE_URL (browser) and PROD_PUBLIC_SUPABASE_URL (server) to connect to production Supabase
```

### Running Scripts

**Diagnostic script:**
```bash
# Check local environment
npx tsx scripts/diagnose-garden.ts

# Check production environment
TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npx tsx scripts/diagnose-garden.ts
```

**Parts sync script:**
```bash
# Sync parts in local environment
npx tsx scripts/sync-parts-manual.ts

# Sync parts in production
TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npx tsx scripts/sync-parts-manual.ts
```

**Test frontmatter system:**
```bash
# Test in production
TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npx tsx scripts/test-frontmatter-system.ts
```

## How It Works

### Configuration Resolution

The `lib/supabase/config.ts` module now resolves the target environment in a browser-safe way:

```typescript
function resolveTargetEnv(): string | undefined {
  return process.env.NEXT_PUBLIC_TARGET_ENV ?? process.env.TARGET_ENV
}

export function getSupabaseUrl(): string | undefined {
  const targetEnv = resolveTargetEnv()
  
  if (targetEnv === 'prod') {
    const prodUrl =
      normalizeUrl(process.env.NEXT_PUBLIC_PROD_SUPABASE_URL) ??
      normalizeUrl(process.env.PROD_PUBLIC_SUPABASE_URL)

    if (!prodUrl) {
      console.warn('[supabase/config] TARGET_ENV=prod but NEXT_PUBLIC_PROD_SUPABASE_URL or PROD_PUBLIC_SUPABASE_URL is not configured')
    }

    const fallbackUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    return prodUrl ?? normalizeUrl(fallbackUrl)
  }

  // Default: use standard env vars (local)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  return normalizeUrl(url)
}
```

### Precedence

1. If `NEXT_PUBLIC_TARGET_ENV=prod` (or `TARGET_ENV=prod` on the server) → prefer `NEXT_PUBLIC_PROD_*` values and fall back to `PROD_*`
2. Otherwise → use `NEXT_PUBLIC_*` variables (local or default)

## Common Workflows

### Development Against Local Database

```bash
# Start local Supabase (Docker)
npm run supabase:start

# Run app against local
npm run dev

# Garden page will show parts from local database
```

### Development Against Production Database

```bash
# Run app against production
TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npm run dev

# Diagnose what's in production
TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npx tsx scripts/diagnose-garden.ts

# Sync markdown parts to production database
TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npx tsx scripts/sync-parts-manual.ts
```

### Switching Between Environments

No need to edit `.env.local` - just change the `TARGET_ENV`/`NEXT_PUBLIC_TARGET_ENV` variables:

```bash
# Work on local
npm run dev

# Ctrl+C to stop

# Switch to production
TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npm run dev

# Ctrl+C to stop

# Back to local
npm run dev
```

## Troubleshooting

### "Supabase environment variables are not configured"

**Cause:** The production credentials aren't set or aren't being loaded.

**Solution:**
1. Verify `.env.local` has `NEXT_PUBLIC_PROD_SUPABASE_URL`, `NEXT_PUBLIC_PROD_SUPABASE_ANON_KEY`, `PROD_PUBLIC_SUPABASE_URL`, `PROD_SUPABASE_ANON_KEY`, and `PROD_SUPABASE_SERVICE_ROLE_KEY`
2. Ensure you're setting both `TARGET_ENV=prod` and `NEXT_PUBLIC_TARGET_ENV=prod` in the same command
3. Restart your terminal or dev server

### Garden shows 0 parts in production

**Cause:** Parts exist in database but not in Supabase Storage as markdown files.

**Solution:**
```bash
# Check what's in the database and storage
TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npx tsx scripts/diagnose-garden.ts

# If parts are in DB but not markdown, that's expected for old parts
# New parts created via chat will automatically be in both
```

### Parts not syncing

**Cause:** Markdown files exist but haven't been synced to database.

**Solution:**
```bash
# Sync markdown to database
TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npx tsx scripts/sync-parts-manual.ts

# Or click "Refresh" button in Garden UI
```

## Production Deployments (Vercel, etc.)

**Important:** The `TARGET_ENV`/`NEXT_PUBLIC_TARGET_ENV` system is for **local development only**. Your production deployments (Vercel, Railway, etc.) do **not** need any changes.

### How Production Works

Production deployments should **not** set `TARGET_ENV` or `NEXT_PUBLIC_TARGET_ENV`. Without them, the code defaults to using standard `NEXT_PUBLIC_*` variables:

**Vercel Environment Variables (no changes needed):**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
MEMORY_STORAGE_ADAPTER=supabase
```

**What happens in production:**
1. `TARGET_ENV`/`NEXT_PUBLIC_TARGET_ENV` are not set (and should not be)
2. Code uses `NEXT_PUBLIC_SUPABASE_URL` (your production URL)
3. Behavior is **identical to before** this feature was added
4. ✅ No migration needed, no breaking changes

### The Three Environments

| Environment | TARGET_ENV | Uses | Setup |
|-------------|------------|------|-------|
| **Vercel/Production** | *(not set)* | `NEXT_PUBLIC_*` | Already configured ✅ |
| **Local Dev (Docker)** | *(not set)* | `NEXT_PUBLIC_*` (local) | Default behavior |
| **Local Dev (Remote)** | `prod` | `NEXT_PUBLIC_PROD_*` (browser) / `PROD_*` (server) | Opt-in for testing |

### Why This Design?

The `TARGET_ENV=prod` / `NEXT_PUBLIC_TARGET_ENV=prod` system is specifically for **local development workflows** where you want to test against production data without permanently changing your `.env.local`. Production deployments continue working exactly as before.

## Security Notes

1. **Never commit production credentials** - `.env.local` is in `.gitignore`
2. **Service role key is powerful** - Treat `PROD_SUPABASE_SERVICE_ROLE_KEY` like a root password
3. **Use different keys** - Local and production should have completely different credentials
4. **Rotate keys if exposed** - If production keys are committed, rotate them immediately in Supabase Dashboard
5. **Don't set TARGET_ENV or NEXT_PUBLIC_TARGET_ENV in production** - These flags are only for local development

## Related Documentation

- [Parts Garden Feature](../features/parts-garden.md) - Garden UI and sync behavior
- [User Memory Operations](./user-memory.md) - Memory storage and markdown system
- [REMOTE_SUPABASE_SETUP.md](../../../REMOTE_SUPABASE_SETUP.md) - Original setup guide (legacy)
