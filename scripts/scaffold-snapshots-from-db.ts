#!/usr/bin/env tsx
/*
  scripts/scaffold-snapshots-from-db.ts
  Create minimal snapshot files (overview + part profiles) for a given user.
  Usage:
    NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... tsx scripts/scaffold-snapshots-from-db.ts <userId>
*/
import { createClient } from '@supabase/supabase-js'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import { buildUserOverviewMarkdown, buildPartProfileMarkdown } from '@/lib/memory/snapshots/grammar'
import { partProfilePath, userOverviewPath } from '@/lib/memory/snapshots/fs-helpers'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const userId = process.argv[2] || process.env.IFS_DEFAULT_USER_ID
  if (!userId) {
    console.error('Provide userId as arg or set IFS_DEFAULT_USER_ID')
    process.exit(1)
  }

  const sb = createClient(url, service)
  const storage = getStorageAdapter()

  // Overview
  const overview = buildUserOverviewMarkdown(userId)
  await storage.putText(userOverviewPath(userId), overview, { contentType: 'text/markdown; charset=utf-8' })

  // Parts
  const { data: parts, error } = await sb
    .from('parts')
    .select('id, name, status, category')
    .eq('user_id', userId)
    .limit(50)
  if (error) throw error

  for (const p of parts || []) {
    const md = buildPartProfileMarkdown({ userId, partId: p.id, name: p.name, status: p.status, category: p.category })
    await storage.putText(partProfilePath(userId, p.id), md, { contentType: 'text/markdown; charset=utf-8' })
  }

  console.log(`Scaffolded overview and ${parts?.length || 0} part profiles for user ${userId}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

