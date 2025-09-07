#!/usr/bin/env tsx
/*
  scripts/smoke-md-tools.ts
  - Patches the Current Focus section in the user's overview using the adapter-based editor.
  Usage examples:
    MEMORY_STORAGE_ADAPTER=local IFS_DEFAULT_USER_ID=000... tsx scripts/smoke-md-tools.ts
    MEMORY_STORAGE_ADAPTER=supabase NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... IFS_DEFAULT_USER_ID=000... tsx scripts/smoke-md-tools.ts
*/
import { editMarkdownSection } from '@/lib/memory/markdown/editor'
import { userOverviewPath } from '@/lib/memory/snapshots/fs-helpers'

async function main() {
  const userId = process.env.IFS_DEFAULT_USER_ID || process.argv[2]
  if (!userId) {
    console.error('Provide userId via IFS_DEFAULT_USER_ID or as an argument')
    process.exit(1)
  }
  const path = userOverviewPath(userId)
  const iso = new Date().toISOString()
  const change = { append: `\n- Updated focus at ${iso}: validating md tools smoke test.\n` }
  const result = await editMarkdownSection(path, 'current_focus v1', change)
  console.log(JSON.stringify({ ok: true, beforeHash: result.beforeHash, afterHash: result.afterHash, warnings: result.lint.warnings }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })

