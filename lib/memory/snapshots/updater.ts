import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import { buildUserOverviewMarkdown, buildPartProfileMarkdown } from '@/lib/memory/snapshots/grammar'
import { userOverviewPath, partProfilePath, relationshipProfilePath } from '@/lib/memory/snapshots/fs-helpers'
import { editMarkdownSection } from '@/lib/memory/markdown/editor'
import { buildRelationshipProfileMarkdown } from '@/lib/memory/snapshots/grammar'
import { logEvent } from '@/lib/memory/events-logger'
import { onPartProfileChanged } from '@/lib/memory/parts-sync'

export async function ensureRelationshipProfileExists(params: { userId: string; relId: string; type: string }): Promise<string> {
  const storage = await getStorageAdapter()
  const path = relationshipProfilePath(params.userId, params.relId)
  const exists = await storage.exists(path)
  if (!exists) {
    const md = buildRelationshipProfileMarkdown(params)
    await storage.putText(path, md, { contentType: 'text/markdown; charset=utf-8' })
  }
  return path
}

export async function onRelationshipLogged(params: { userId: string; relId: string; type: string; summary: string }) {
  const path = await ensureRelationshipProfileExists({ userId: params.userId, relId: params.relId, type: params.type })
  await appendChangeLogWithEvent({
    userId: params.userId,
    entityType: 'relationship',
    entityId: params.relId,
    filePath: path,
    line: params.summary,
  })
}
function isoNow() { return new Date().toISOString() }

export async function ensureUserOverviewExists(userId: string): Promise<string> {
  const storage = await getStorageAdapter()
  const path = userOverviewPath(userId)
  const exists = await storage.exists(path)
  if (!exists) {
    const md = buildUserOverviewMarkdown(userId)
    await storage.putText(path, md, { contentType: 'text/markdown; charset=utf-8' })
  }
  return path
}

export async function ensurePartProfileExists(params: { userId: string; partId: string; name: string; status: string; category: string; emoji?: string }): Promise<{ path: string; created: boolean }> {
  const storage = await getStorageAdapter()
  const path = partProfilePath(params.userId, params.partId)
  const exists = await storage.exists(path)
  if (!exists) {
    const md = buildPartProfileMarkdown(params)
    await storage.putText(path, md, { contentType: 'text/markdown; charset=utf-8' })
    // Sync newly created profile to database immediately
    await onPartProfileChanged(params.userId, params.partId)
    return { path, created: true }
  }
  return { path, created: false }
}

export async function appendChangeLogWithEvent(params: { userId: string; entityType: 'user' | 'part' | 'relationship'; entityId: string; filePath: string; line: string }) {
  const ts = isoNow()
  const res = await editMarkdownSection(params.filePath, 'change_log v1', { append: `\n- ${ts}: ${params.line}\n` })
  try {
    await logEvent({
      userId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
      type: 'profile_update',
      op: 'append_section',
      sectionAnchor: 'change_log v1',
      filePath: params.filePath,
      rationale: params.line,
      beforeHash: res.beforeHash,
      afterHash: res.afterHash,
      evidenceRefs: [],
      lint: { warnings: res.lint.warnings },
      integritySource: { kind: 'text', value: res.text },
      status: 'committed',
    })
  } catch (e) { try { console.warn('logEvent error', e) } catch {} }
}

export async function onPartCreated(params: { userId: string; partId: string; name: string; status: string; category: string; emoji?: string }) {
  const { path } = await ensurePartProfileExists(params)
  await appendChangeLogWithEvent({
    userId: params.userId,
    entityType: 'part',
    entityId: params.partId,
    filePath: path,
    line: `created part "${params.name}" (status: ${params.status}, category: ${params.category})`,
  })
  // Sync to database after logging the creation
  await onPartProfileChanged(params.userId, params.partId)
}

export async function onPartUpdated(params: { userId: string; partId: string; name: string; change: string }) {
  const { path } = await ensurePartProfileExists({ userId: params.userId, partId: params.partId, name: params.name, status: 'unknown', category: 'unknown' })
  await appendChangeLogWithEvent({
    userId: params.userId,
    entityType: 'part',
    entityId: params.partId,
    filePath: path,
    line: `updated part "${params.name}": ${params.change}`,
  })
  // Sync to database after logging the update
  await onPartProfileChanged(params.userId, params.partId)
}

