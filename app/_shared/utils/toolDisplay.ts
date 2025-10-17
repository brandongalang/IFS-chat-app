import type { TaskEvent, ToolActivityEntry } from '@/types/chat'

const TOOL_COPY_RULES: Array<{
  match: RegExp
  title: string
  note?: string
  statusCopy?: string
}> = [
  {
    match: /(search|lookup|retrieve|query|parts|insight|observation|memory)/i,
    title: "Looking through notes…",
  },
  {
    match: /(write|save|record|log|note|capture|store)/i,
    title: "Writing notes…",
  },
  {
    match: /(summarize|summary|digest|condense)/i,
    title: "Summarizing…",
  },
  {
    match: /(gather|collect|context|prepare|load|fetch)/i,
    title: "Gathering context…",
  },
  {
    match: /(plan|brainstorm|analyze|assess|review)/i,
    title: "Thinking it through…",
  },
]

function cleanToolName(candidate?: string | null): string {
  if (!candidate) return ""
  return candidate
    .replace(/^tool[-:]/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function titleCase(value: string): string {
  if (!value) return value
  return value
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

export type ToolDisplayCopy = {
  title: string
  note?: string
  statusCopy?: string
}

export function getToolDisplayCopy(rawName?: string | null, toolType?: string | null): ToolDisplayCopy {
  const name = cleanToolName(rawName) || cleanToolName(toolType)

  for (const rule of TOOL_COPY_RULES) {
    if (name && rule.match.test(name)) {
      return {
        title: rule.title,
        note: rule.note,
        statusCopy: rule.statusCopy,
      }
    }
  }

  const fallbackTitle = titleCase(name)
  if (fallbackTitle) {
    return { title: fallbackTitle }
  }

  return { title: "Working on it…" }
}

export function friendlyLabelFromType(toolType?: string | null): string {
  const cleaned = cleanToolName(toolType)
  if (!cleaned) return "Tool"
  const titled = titleCase(cleaned)
  return titled || "Tool"
}

export function normalizeToolSubtitle(subtitle?: string | null): string | undefined {
  if (!subtitle) return undefined
  const trimmed = subtitle.trim()
  if (!trimmed) return undefined
  if (/^(limit|offset|page)\s*\d+$/i.test(trimmed)) {
    return undefined
  }
  return trimmed
}

type ActivityContext = {
  part: ToolUIPartLike
  update: { id: string; status?: string; title?: string }
  friendlyTitle: string
  note?: string
}

export type ToolUIPartLike = {
  toolCallId?: string
  toolName?: string
  state?: string
  meta?: Record<string, unknown>
  type?: string
}

const STATUS_DESCRIPTIONS: Record<TaskEvent['status'], string> = {
  pending: 'Queued',
  working: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  canceled: 'Canceled',
}

const STATUS_NORMALIZATION: Record<string, TaskEvent['status']> = {
  pending: 'pending',
  queued: 'pending',
  queueing: 'pending',
  working: 'working',
  processing: 'working',
  running: 'working',
  streaming: 'working',
  inprogress: 'working',
  'in-progress': 'working',
  completed: 'completed',
  complete: 'completed',
  success: 'completed',
  succeeded: 'completed',
  finished: 'completed',
  failed: 'failed',
  error: 'failed',
  errored: 'failed',
  failure: 'failed',
  canceled: 'canceled',
  cancelled: 'canceled',
  abort: 'canceled',
  aborted: 'canceled',
}

function normalizeActivityStatus(raw?: string): TaskEvent['status'] {
  if (!raw) return 'working'
  const key = raw.toLowerCase().replace(/\s+/g, '')
  return STATUS_NORMALIZATION[key] ?? 'working'
}

function buildActivityText(ctx: ActivityContext): string | undefined {
  const status = normalizeActivityStatus(ctx.update.status)
  if (ctx.note) return ctx.note
  if (ctx.part.meta && typeof ctx.part.meta.displayNote === 'string') {
    const normalized = normalizeToolSubtitle(ctx.part.meta.displayNote)
    if (normalized) return normalized
  }
  if (STATUS_DESCRIPTIONS[status]) {
    return STATUS_DESCRIPTIONS[status]
  }
  return undefined
}

export function toActivityEntry(ctx: ActivityContext): ToolActivityEntry | undefined {
  const text = buildActivityText(ctx)
  if (!text) return undefined
  const status = normalizeActivityStatus(ctx.update.status)
  const toolTitle = ctx.friendlyTitle || ctx.update.title
  const key = ctx.part.toolCallId ?? ctx.update.id
  return {
    id: `${key}-${status}-${Date.now()}`,
    text,
    status,
    timestamp: Date.now(),
    toolTitle,
  }
}
