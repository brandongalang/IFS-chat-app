# Setup Supabase Storage for Memory V2 System

This guide will help you configure the Memory V2 system to use **Supabase Storage** instead of local file system storage.

## Overview

The Memory V2 system stores part profiles, relationships, and other user data as markdown files. You can choose between:
- 🏠 **Local Storage** - Files stored in `.data/memory-snapshots/` (dev only)
- ☁️ **Supabase Storage** - Files stored in Supabase bucket (production-ready)

## Prerequisites

✅ Supabase project with:
- Project URL
- Anon key (public)
- Service role key (secret)

## Step 1: Create the Storage Bucket

You need to create a storage bucket called `memory-snapshots` in your Supabase project.

### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Click **Storage** in the left sidebar
4. Click **New bucket**
5. Configure:
   - **Name**: `memory-snapshots`
   - **Public bucket**: ❌ **OFF** (keep private)
   - **File size limit**: 10 MB (default is fine)
   - **Allowed MIME types**: Leave empty (all allowed)
6. Click **Create bucket**

### Option B: Via SQL Migration

Create a new migration file:

```bash
npx supabase migration new create_memory_snapshots_bucket
```

Add this SQL to the migration file:

```sql
-- Create storage bucket for Memory V2 system
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'memory-snapshots',
  'memory-snapshots',
  false,  -- Private bucket
  10485760,  -- 10 MB limit
  NULL  -- Allow all MIME types
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for memory-snapshots bucket
-- Users can only access their own memory files

-- Policy: Users can read their own memory files
CREATE POLICY "Users can read own memory files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'memory-snapshots' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Policy: Users can create their own memory files
CREATE POLICY "Users can create own memory files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'memory-snapshots' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Policy: Users can update their own memory files
CREATE POLICY "Users can update own memory files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'memory-snapshots' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Policy: Users can delete their own memory files
CREATE POLICY "Users can delete own memory files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'memory-snapshots' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);
```

Apply the migration:

```bash
# For remote Supabase
npx supabase db push --linked

# For local Supabase (if using Docker)
npx supabase db push
```

## Step 2: Configure Environment Variables

Add this line to your `.env.local` file:

```bash
# Memory Storage Configuration
MEMORY_STORAGE_ADAPTER=supabase
```

### Complete Example

Your `.env.local` should have these memory-related variables:

```bash
# ===== SUPABASE CONFIGURATION =====
# For Production/Remote Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# ===== MEMORY STORAGE CONFIGURATION =====
# Use Supabase Storage for markdown files
MEMORY_STORAGE_ADAPTER=supabase

# Optional: Enable/disable Memory V2 (defaults to enabled)
# MEMORY_AGENTIC_V2_ENABLED=true

# Note: MEMORY_LOCAL_ROOT is not used when MEMORY_STORAGE_ADAPTER=supabase
```

## Step 3: Verify the Setup

### 3.1 Check Storage Adapter

Create a test script to verify the adapter:

```bash
node -e "
const { getStorageMode } = require('./lib/memory/config.ts');
console.log('Storage mode:', getStorageMode());
"
```

You should see: `Storage mode: supabase`

### 3.2 Test File Operations

Run the chat and create a new part. The system should:
1. Create a part in the database
2. Create a markdown profile in Supabase Storage at `users/{userId}/parts/{partId}/profile.md`

### 3.3 Verify in Dashboard

1. Go to Supabase Dashboard → Storage → `memory-snapshots`
2. You should see a folder structure: `users/{userId}/parts/...`

## Step 4: Migrate Existing Local Data (Optional)

If you have existing data in `.data/memory-snapshots/`, you can migrate it:

### Manual Migration Script

Create `scripts/migrate-local-to-supabase.ts`:

```typescript
import { LocalFsStorageAdapter } from '@/lib/memory/storage/local-fs-adapter'
import { SupabaseStorageAdapter } from '@/lib/memory/storage/supabase-storage-adapter'

async function migrate() {
  const local = new LocalFsStorageAdapter()
  const supabase = new SupabaseStorageAdapter()
  
  // List all files in local storage
  const files = await local.list('users')
  
  console.log(`Found ${files.length} files to migrate`)
  
  for (const file of files) {
    console.log(`Migrating: ${file}`)
    
    // Read from local
    const content = await local.getText(file)
    if (!content) {
      console.log(`  ⚠️  Skipped (empty): ${file}`)
      continue
    }
    
    // Write to Supabase
    await supabase.putText(file, content)
    console.log(`  ✅ Migrated: ${file}`)
  }
  
  console.log('Migration complete!')
}

migrate().catch(console.error)
```

Run it:

```bash
npx tsx scripts/migrate-local-to-supabase.ts
```

## Troubleshooting

### Issue: "Supabase Storage adapter requires URL and service role key"

**Cause**: Missing environment variables

**Solution**: Make sure you have these set in `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Issue: Storage 404 errors

**Cause**: Bucket doesn't exist or wrong name

**Solution**: 
1. Check bucket exists: Dashboard → Storage → Look for `memory-snapshots`
2. Verify bucket name matches `MEMORY_SNAPSHOTS_BUCKET` in `lib/memory/config.ts`

### Issue: Permission denied errors

**Cause**: RLS policies not configured

**Solution**: Apply the RLS policies from Step 1, Option B

### Issue: Service role key errors

**Cause**: Using anon key instead of service role key

**Solution**: The Memory V2 system needs **service role key** because it bypasses RLS:
- ✅ Use `SUPABASE_SERVICE_ROLE_KEY` 
- ❌ Don't use `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Architecture

```
┌─────────────────────────────────────────────┐
│  Memory V2 System                           │
│  (Markdown-based Agent Memory)              │
└────────────┬────────────────────────────────┘
             │
      ┌──────┴──────┐
      │ env config  │
      │ MEMORY_     │
      │ STORAGE_    │
      │ ADAPTER     │
      └──────┬──────┘
             │
    ┌────────┴─────────┐
    │                  │
    │ = supabase       │
    │                  │
    ▼                  │
┌──────────────────┐   │
│ Supabase         │   │
│ Storage Adapter  │   │
└────────┬─────────┘   │
         │             │
         ▼             │
┌──────────────────┐   │
│ Supabase Storage │   │
│ Bucket:          │   │
│ memory-snapshots │   │
│                  │   │
│ users/           │   │
│ ├─ {userId}/     │   │
│    ├─ parts/     │   │
│    │  └─ {id}/   │   │
│    │     profile │   │
│    │     .md     │   │
│    ├─ overview   │   │
│    │  .md        │   │
│    └─ relation   │   │
│       ships/     │   │
└──────────────────┘   │
                       │
    NOT USED when      │
    adapter=supabase   │
                       │
┌──────────────────┐   │
│ Local Filesystem │ ◄─┘
│ .data/memory-    │
│ snapshots/       │
└──────────────────┘
```

## Benefits of Supabase Storage

✅ **Persistent** - Survives deployments
✅ **Scalable** - Handles multiple server instances
✅ **Secure** - RLS policies protect user data
✅ **Accessible** - Works from any environment
✅ **Production-ready** - No local file system dependencies

## Related Documentation

- [Configuration Management](./docs/current/architecture/config-management.md)
- [Memory V2 System](./docs/current/operations/user-memory.md)
- [Parts System Overview](./docs/current/architecture/parts-systems-overview.md)

## Quick Reference

### Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `MEMORY_STORAGE_ADAPTER` | `supabase` | Use Supabase Storage |
| `MEMORY_STORAGE_ADAPTER` | `local` | Use local filesystem (dev only) |
| `MEMORY_AGENTIC_V2_ENABLED` | `true` | Enable Memory V2 (default) |
| `MEMORY_AGENTIC_V2_ENABLED` | `false` | Disable Memory V2 |

### File Paths

Storage paths follow this structure:
- User overview: `users/{userId}/overview.md`
- Part profile: `users/{userId}/parts/{partId}/profile.md`
- Relationship: `users/{userId}/relationships/{relId}/profile.md`
- Session: `users/{userId}/sessions/{sessionId}/transcript.json`

### Checking Current Mode

```typescript
import { getStorageMode } from '@/lib/memory/config'
console.log(getStorageMode()) // 'local' or 'supabase'
```

---

**Need help?** Check the troubleshooting section or review the adapter code:
- `lib/memory/storage/supabase-storage-adapter.ts`
- `lib/memory/storage/local-fs-adapter.ts`
