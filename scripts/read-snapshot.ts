#!/usr/bin/env tsx
/*
  scripts/read-snapshot.ts
  Reads a snapshot (overview or part/relationship profile) and prints its section map.
  Usage:
    # Overview
    IFS_DEFAULT_USER_ID=000... tsx scripts/read-snapshot.ts overview

    # Part profile
    IFS_DEFAULT_USER_ID=000... tsx scripts/read-snapshot.ts part <partId>

    # Relationship profile
    IFS_DEFAULT_USER_ID=000... tsx scripts/read-snapshot.ts relationship <relId>
*/
import { readOverviewSections, readPartProfileSections, readRelationshipProfileSections } from '@/lib/memory/read'

async function main() {
  const userId = process.env.IFS_DEFAULT_USER_ID || ''
  const kind = process.argv[2]
  if (!kind) {
    console.error('Specify one of: overview | part <partId> | relationship <relId>')
    process.exit(1)
  }
  if (!userId) {
    console.error('Set IFS_DEFAULT_USER_ID to read snapshots for a user')
    process.exit(1)
  }

  if (kind === 'overview') {
    const m = await readOverviewSections(userId)
    console.log(JSON.stringify(m, null, 2))
    return
  }
  if (kind === 'part') {
    const partId = process.argv[3]
    if (!partId) { console.error('Provide partId'); process.exit(1) }
    const m = await readPartProfileSections(userId, partId)
    console.log(JSON.stringify(m, null, 2))
    return
  }
  if (kind === 'relationship') {
    const relId = process.argv[3]
    if (!relId) { console.error('Provide relId'); process.exit(1) }
    const m = await readRelationshipProfileSections(userId, relId)
    console.log(JSON.stringify(m, null, 2))
    return
  }
  console.error('Unknown kind. Use: overview | part <partId> | relationship <relId>')
  process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })

