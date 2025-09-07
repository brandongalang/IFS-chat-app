import { getStorageAdapter, userOverviewPath } from '@/lib/memory/snapshots/fs-helpers'
import { buildUserOverviewMarkdown } from '@/lib/memory/snapshots/grammar'
import { readOverviewSections } from '@/lib/memory/read'

/**
 * Ensure the user's overview snapshot exists. If missing, create a minimal overview
 * with canonical sections and an initialized change log entry.
 */
export async function ensureOverviewExists(userId: string) {
  const existing = await readOverviewSections(userId)
  if (existing) return { created: false }
  const storage = await getStorageAdapter()
  const path = userOverviewPath(userId)
  const md = buildUserOverviewMarkdown(userId)
  await storage.putText(path, md, { contentType: 'text/markdown; charset=utf-8' })
  return { created: true }
}

