import { sha256Hex } from '@/lib/memory/canonicalize'
import { logEvent, type EventEntityType } from '@/lib/memory/events-logger'

type MutationMode = 'append' | 'replace' | 'create'

interface MarkdownMutationLog {
  userId: string
  filePath: string
  anchor?: string
  mode: MutationMode
  text: string
  beforeHash?: string | null
  afterHash: string
  warnings: string[]
  rationale?: string
}

function inferEntityContext(filePath: string, userId: string): {
  entityType: EventEntityType
  entityId: string | null
} {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized.startsWith('users/')) {
    return { entityType: 'note', entityId: null }
  }

  const [, pathUserId, scope, targetId] = normalized.split('/')
  if (!pathUserId || pathUserId !== userId) {
    return { entityType: 'note', entityId: null }
  }

  if (scope === 'parts' && targetId) {
    return { entityType: 'part', entityId: targetId }
  }

  if (scope === 'relationships' && targetId) {
    return { entityType: 'relationship', entityId: targetId }
  }

  return { entityType: 'user', entityId: userId }
}

function resolveOperation(mode: MutationMode): 'append_section' | 'replace_section' {
  return mode === 'append' ? 'append_section' : 'replace_section'
}

export async function logMarkdownMutation(params: MarkdownMutationLog): Promise<void> {
  const { userId, filePath, mode, text, beforeHash, afterHash, warnings, anchor, rationale } = params
  const { entityType, entityId } = inferEntityContext(filePath, userId)

  try {
    await logEvent({
      userId,
      entityType,
      entityId,
      type: 'profile_update',
      op: resolveOperation(mode),
      sectionAnchor: anchor ?? null,
      filePath,
      rationale: rationale ?? `markdown ${mode} ${anchor ?? ''}`.trim(),
      beforeHash: beforeHash ?? null,
      afterHash,
      evidenceRefs: [],
      lint: { warnings },
      integritySource: { kind: 'text', value: text },
      status: 'committed',
    })
  } catch (error) {
    try {
      console.error('[markdown logging] logEvent failed', { error, filePath, mode, anchor })
    } catch {}
  }
}

export function computeMarkdownHash(text: string): string {
  return 'sha256:' + sha256Hex(text)
}
