# Pre-Merge Checklist for feat/markdown-adapter

## ✅ Completed

- [x] Recursive storage listing implemented in `lib/memory/storage/supabase-storage-adapter.ts`
- [x] Multi-environment configuration system (`TARGET_ENV` support)
- [x] Scripts updated (diagnose-garden, sync-parts-manual)
- [x] Documentation added and updated
- [x] Local testing passed (both local and prod environments)
- [x] Production Supabase connectivity verified
- [x] Documentation clarifies no Vercel changes needed
- [x] All changes committed and pushed to `feat/markdown-adapter`

## 🔍 Pre-Merge Verification Needed

### 1. Verify Supabase Storage Bucket

**Check if `memory-snapshots` bucket exists in production:**

```bash
# Option A: Check via Supabase Dashboard
# 1. Go to https://supabase.com/dashboard/project/pegclbtzfaccnhmkviqb/storage/buckets
# 2. Look for 'memory-snapshots' bucket

# Option B: Test via script
TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npx tsx -e "
import { getStorageAdapter } from './lib/memory/snapshots/fs-helpers.js';
const storage = await getStorageAdapter();
const files = await storage.list('users');
console.log('Storage accessible:', files);
"
```

**If bucket doesn't exist, create it:**

```sql
-- Run in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('memory-snapshots', 'memory-snapshots', false, 52428800, NULL);
```

**Set up RLS policies:**

```sql
-- Allow authenticated users to access their own files
CREATE POLICY "Users can manage own memory snapshots"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'memory-snapshots' 
  AND (storage.foldername(name))[1] = 'users' 
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow service role full access
CREATE POLICY "Service role full access to memory snapshots"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'memory-snapshots');
```

### 2. Test the Fix End-to-End

**Create a test part with the new system:**

```bash
# Run test that creates a part with frontmatter
TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npx tsx scripts/test-frontmatter-system.ts
```

**Expected outcome:**
- ✅ Part markdown file created in Supabase Storage with frontmatter
- ✅ Part synced to database with correct metadata
- ✅ Emoji from frontmatter appears in database visualization

### 3. Verify Garden Refresh Works

```bash
# Start app against production
TARGET_ENV=prod MEMORY_STORAGE_ADAPTER=supabase npm run dev

# Navigate to http://localhost:3000/garden
# Click "Refresh" button
# Should see parts appear (or count update)
```

### 4. Check for Breaking Changes

**Review changes that could affect existing functionality:**

- [x] `lib/supabase/config.ts` - Changes are backwards compatible (defaults to NEXT_PUBLIC_*)
- [x] Storage adapter `list()` - More thorough (recursive), won't break existing code
- [x] Scripts - Enhanced but backwards compatible

**No breaking changes identified** ✅

## 📋 Merge Steps

Once verification is complete:

1. **Update PR description** with:
   - Summary of changes (recursive listing + multi-env config)
   - Testing performed
   - Migration notes (none needed for Vercel)
   - Supabase bucket setup instructions (if needed)

2. **Run docs CI check** (if applicable):
   ```bash
   # Ensure all docs are updated per AGENTS.md
   ```

3. **Merge to main** via GitHub PR

4. **Post-merge verification:**
   - Wait for Vercel deployment
   - Test Garden in production
   - Verify no errors in Vercel logs

## 🎯 Current Status

**Ready for:** Final verification (steps 1-3 above)

**Blocking issues:** None identified

**Estimated time to merge:** 15-30 minutes (mostly Supabase bucket setup if needed)

## 📝 Notes

- The branch already contains the recursive listing fix from earlier work
- Multi-environment support is additive and backwards compatible
- Production deployments (Vercel) require no changes
- Local developers can now easily test against production DB
