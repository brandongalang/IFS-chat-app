# Quick Start: Remote Supabase Setup

This guide will get you up and running with **remote Supabase only** (no local storage).

## What You'll Do

1. ✅ Set environment variable to use Supabase Storage
2. ✅ Apply migration to create storage bucket
3. ✅ Sync existing parts to database
4. ✅ Test the setup

## Prerequisites

Based on your `.env.local`, you already have:
- ✅ Production Supabase credentials
- ✅ Service role key

## Step 1: No Configuration Needed! ✨

**Good news**: The app is already configured to use Supabase Storage exclusively!

Your `.env.local` just needs your Supabase credentials (which you already have):

```bash
# ===== PRODUCTION SUPABASE =====
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

That's it! Memory V2 automatically uses Supabase Storage - no environment variables needed.

## Step 2: Apply Storage Bucket Migration

The migration file already exists: `supabase/migrations/110_memory_snapshots_bucket.sql`

Apply it to your remote Supabase:

```bash
# Link to your remote project (if not already linked)
npx supabase link --project-ref your-project-ref

# Apply the migration
npx supabase db push
```

This will create:
- ✅ Storage bucket: `memory-snapshots`
- ✅ RLS policies for user access
- ✅ Service role access for agent operations

## Step 3: Verify Storage Bucket

1. Go to your Supabase Dashboard → Storage → Buckets
2. You should see a bucket named `memory-snapshots`
3. It should be marked as **Private** (not public)

## Step 4: Test the Setup

### 4.1 Start your dev server

```bash
npm run dev
```

### 4.2 Verify storage is working

The app automatically uses Supabase Storage. To verify:

1. Check the config:
   ```typescript
   import { getStorageMode } from '@/lib/memory/config'
   console.log(getStorageMode()) // Always returns: 'supabase'
   ```

2. Storage is hardcoded - no environment variable needed!

### 4.3 Sync Parts to Database

Navigate to the Parts Garden page in your app:
```
http://localhost:3000/garden
```

Click the **"Refresh"** button. This will:
1. Read all part profiles from Supabase Storage
2. Sync them to the database
3. Show you how many parts were synced

You should see: `✅ Synced 9 parts` (or similar)

### 4.4 Create a New Part via Chat

1. Go to the chat: `http://localhost:3000/chat`
2. Talk to the agent about discovering a new part
3. Let the agent create the part

Behind the scenes, this will:
1. Create part profile in **Supabase Storage** at `users/{userId}/parts/{partId}/profile.md`
2. Sync to database automatically
3. Part appears in Garden immediately

## Step 5: Verify Files in Storage

1. Go to Supabase Dashboard → Storage → `memory-snapshots`
2. Browse to `users/{your-user-id}/parts/`
3. You should see folders for each part with `profile.md` files

## Architecture Flow

```
┌──────────────────────────────────────────────────┐
│  User interacts with Chat Agent                  │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  Agent creates/updates part                      │
│  (Mastra tools)                                  │
└────────────────┬─────────────────────────────────┘
                 │
        ┌────────┴──────────┐
        │                   │
        ▼                   ▼
┌──────────────────┐  ┌─────────────────────┐
│ Supabase Storage │  │ Supabase Database   │
│ memory-snapshots │  │ parts table         │
│                  │  │                     │
│ users/{id}/      │  │ - id                │
│  parts/          │  │ - name              │
│   {partId}/      │  │ - status            │
│    profile.md    │  │ - category          │
└──────────────────┘  └─────────────────────┘
        │                   │
        └────────┬──────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  Garden UI displays parts from database          │
│  (queries Supabase via RLS)                      │
└──────────────────────────────────────────────────┘
```

## What Changed

### Before (Local Storage)
```
Agent → Markdown files in .data/memory-snapshots/ 
     → [Manual sync needed]
     → Database
     → Garden UI
```

### After (Supabase Storage)
```
Agent → Markdown files in Supabase Storage (memory-snapshots bucket)
     → [Auto sync via hooks]
     → Database
     → Garden UI
```

## Troubleshooting

### "Storage adapter requires URL and service role key"

**Solution**: Make sure your `.env.local` has:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### "Bucket not found" errors

**Solution**: Run the migration:
```bash
npx supabase db push
```

### Parts not syncing

**Solution**: Click the Refresh button in Garden page manually, or check the sync hooks are enabled.

### Storage permission errors

**Solution**: The RLS policies use `auth.uid()`. Make sure:
1. User is authenticated
2. Service role key is used for agent operations (bypasses RLS)

## Clean Up Local Storage (Optional)

If you had local markdown files in `.data/memory-snapshots/`, you can delete them now:

```bash
# Backup first (optional)
mv .data/memory-snapshots .data/memory-snapshots.backup

# Or just delete
rm -rf .data/memory-snapshots
```

The agent will now use Supabase Storage exclusively.

## Next Steps

1. ✅ All markdown files now stored in Supabase
2. ✅ Works across all environments (dev, staging, prod)
3. ✅ No more local file dependencies
4. ✅ Parts persist across deployments

## Configuration Reference

Memory V2 is **zero-config**! It just works with your Supabase credentials:

```bash
# Required: Your Supabase project credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Feature flag (defaults to true)
# MEMORY_AGENTIC_V2_ENABLED=true
```

No `MEMORY_STORAGE_ADAPTER` or `MEMORY_LOCAL_ROOT` needed - it's always Supabase!

## Files Modified

- ✅ `supabase/migrations/110_memory_snapshots_bucket.sql` - Created bucket and RLS policies
- ✅ No environment variables needed! Supabase Storage is the default.
- ✅ No code changes needed! It just works.

---

**You're all set!** 🎉

Your app now uses Supabase Storage exclusively for the Memory V2 system.
