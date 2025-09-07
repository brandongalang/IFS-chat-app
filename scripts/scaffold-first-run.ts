#!/usr/bin/env tsx
/**
 * scripts/scaffold-first-run.ts
 * Ensures the overview snapshot exists for IFS_DEFAULT_USER_ID.
 */
import { ensureOverviewExists } from '@/lib/memory/snapshots/scaffold'

async function main() {
  const userId = process.env.IFS_DEFAULT_USER_ID
  if (!userId) {
    console.error('Set IFS_DEFAULT_USER_ID')
    process.exit(1)
  }
  const res = await ensureOverviewExists(userId)
  console.log(JSON.stringify(res))
}

main().catch((e) => { console.error(e); process.exit(1) })

