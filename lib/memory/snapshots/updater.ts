import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import { buildUserOverviewMarkdown, buildPartProfileMarkdown } from '@/lib/memory/snapshots/grammar'
import { userOverviewPath, partProfilePath } from '@/lib/memory/snapshots/fs-helpers'
import { editMarkdownSection } from '@/lib/memory/markdown/editor'

function isoNow() { return new Date().toISOString() }

export async function ensureUserOverviewExists(userId: string): Promise<string> {
  const storage = getStorageAdapter()
  const path = userOverviewPath(userId)
  const exists = await storage.exists(path)
  if (!exists) {
    const md = buildUserOverviewMarkdown(userId)
    await storage.putText(path, md, { contentType: 'text/markdown; charset=utf-8' })
  }
  return path
}

export async function ensurePartProfileExists(params: { userId: string; partId: string; name: string; status: string; category: string }): Promise<string> {
  const storage = getStorageAdapter()
  const path = partProfilePath(params.userId, params.partId)
  const exists = await storage.exists(path)
  if (!exists) {
    const md = buildPartProfileMarkdown(params)
    await storage.putText(path, md, { contentType: 'text/markdown; charset=utf-8' })
  }
  return path
}

export async function appendChangeLog(path: string, line: string) {
  const ts = isoNow()
  await editMarkdownSection(path, 'change_log v1', { append: `\n- ${ts}: ${line}\n` })
}

export async function onPartCreated(params: { userId: string; partId: string; name: string; status: string; category: string }) {
  const path = await ensurePartProfileExists(params)
  await appendChangeLog(path, `created part \"${params.name}\" (status: ${params.status}, category: ${params.category})`)
}

export async function onPartUpdated(params: { userId: string; partId: string; name: string; change: string }) {
  const path = await ensurePartProfileExists({ userId: params.userId, partId: params.partId, name: params.name, status: 'unknown', category: 'unknown' })
  await appendChangeLog(path, `updated part \"${params.name}\": ${params.change}`)
}

