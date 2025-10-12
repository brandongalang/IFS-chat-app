# Snapshots — Storage Adapters and Scaffolding

This PR introduces a storage abstraction and minimal snapshot scaffolding:

- StorageAdapter interface with two implementations:
  - LocalFsStorageAdapter (development): writes to .data/memory-snapshots (git-ignored)
  - SupabaseStorageAdapter (staging/prod): writes to a private `memory-snapshots` bucket
- Minimal Markdown grammar builders for user overview and part profiles with hidden anchors
- Scaffold script to write overview.md and part profiles for a given user using the configured storage adapter

Usage
- Local dev (default):
  - MEMORY_STORAGE_ADAPTER=local (default)
  - npm run snapshots:scaffold — uses IFS_DEFAULT_USER_ID if no arg supplied
- Staging/Prod:
  - MEMORY_STORAGE_ADAPTER=supabase
  - Ensure `memory-snapshots` bucket exists in Supabase Storage (private)
  - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only)

Command
```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run snapshots:scaffold -- <userId>
```

Notes
- No agent write-path changes yet; this establishes storage plumbing and basic content generators.
- All writes are via server/service-role for Supabase; the browser never accesses the bucket directly.
- Session-oriented Mastra tools (e.g., insight research and evidence utilities) read recent sessions through this adapter instead of direct Supabase queries.

