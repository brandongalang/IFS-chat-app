import { Operation, applyPatch, compare } from 'fast-json-patch'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserMemory } from './types'
import { INITIAL_USER_MEMORY } from './types'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'

const CHECKPOINT_FREQUENCY = Number(process.env.USER_MEMORY_CHECKPOINT_EVERY || 50)

// Zod schema aligning to our MVP memory
const userMemorySchema = z.object({
  version: z.number(),
  last_updated_by: z.string(),
  summary: z.string(),
  parts: z.record(z.object({
    name: z.string(),
    status: z.string(),
    recency_score: z.number().optional(),
    influence_score: z.number().optional(),
    goals: z.array(z.object({ goal: z.string() })).optional(),
  })),
  triggers_and_goals: z.array(z.object({
    trigger: z.string(),
    desired_outcome: z.string(),
    related_parts: z.array(z.string()),
  })),
  safety_notes: z.string().optional(),
})

export async function reconstructMemory(userId: string): Promise<UserMemory> {
  const supabase = createAdminClient()
  // Find latest full snapshot (checkpoint)
  const { data: checkpointRows, error: cpErr } = await supabase
    .from('user_memory_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('is_full_snapshot', true)
    .order('version', { ascending: false })
    .limit(1)

  if (cpErr) throw cpErr

  let base: UserMemory = INITIAL_USER_MEMORY
  let startVersion = 0

  if (checkpointRows && checkpointRows.length > 0) {
    const cp = checkpointRows[0]
    base = (cp.full_snapshot_content as UserMemory) || INITIAL_USER_MEMORY
    startVersion = cp.version
  }

  // Apply patches since checkpoint
  const { data: patches, error: pErr } = await supabase
    .from('user_memory_snapshots')
    .select('version, patch')
    .eq('user_id', userId)
    .gt('version', startVersion)
    .order('version', { ascending: true })

  if (pErr) throw pErr

  let doc: UserMemory = base
  for (const row of patches || []) {
    const ops = row.patch as Operation[]
    // fast-json-patch mutates by default when applyPatch(doc, ops).newDocument if mutateDocument=true
    const result = applyPatch(structuredClone(doc), ops, /*validate*/ false, /*mutateDocument*/ false)
    doc = result.newDocument as UserMemory
  }

  return doc
}

export async function computeNextVersion(userId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('user_memory_snapshots')
    .select('version')
    .eq('user_id', userId)
    .order('version', { ascending: false })
    .limit(1)

  if (error) throw error
  const last = data && data.length ? data[0].version : 0
  return last + 1
}

export async function saveNewSnapshot(params: {
  userId: string
  previous: UserMemory
  next: UserMemory
  source?: string
}): Promise<{ version: number; saved: boolean; isCheckpoint: boolean }> {
  const version = await computeNextVersion(params.userId)
  const patch: Operation[] = compare(params.previous, params.next)

  const isCheckpoint = version % CHECKPOINT_FREQUENCY === 0
  const supabase = createAdminClient()

  const insertPayload: Record<string, unknown> = {
    user_id: params.userId,
    version,
    patch: patch,
    is_full_snapshot: isCheckpoint,
    source_description: params.source || 'daily-update',
  }
  if (isCheckpoint) {
    insertPayload.full_snapshot_content = params.next
  }

  const { error } = await supabase.from('user_memory_snapshots').insert(insertPayload)
  if (error) throw error

  return { version, saved: true, isCheckpoint }
}

interface TodayData {
    sessions: Record<string, unknown>[]
    insights: Record<string, unknown>[]
    checkIns: Record<string, unknown>[]
}

// Fallback: if model key missing or error, return a light touch update
async function fallbackUpdate(old: UserMemory): Promise<UserMemory> {
  return {
    ...old,
    version: old.version + 1,
    last_updated_by: 'system',
  }
}

export async function generateMemoryUpdate(params: {
  userId: string
  oldMemory: UserMemory
  todayData: TodayData
}): Promise<UserMemory> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return fallbackUpdate(params.oldMemory)

  const provider = createOpenRouter({ apiKey })

  // Keep prompt compact but instructive, aligned with IFS agent tone
  const system = `
You are the Memory Summarizer for the IFS companion app.
Your purpose is to maintain a stable, evolving "user memory" hub that captures what is most relevant about the user for future agent interactions.
This hub should reflect meaningful updates while remaining concise and consistent; it does not duplicate raw session logs or entire insights.

Tone and principles (aligned with the IFS agent):
- Calm, curious, non-judgmental, and respectful.
- No therapy or clinical advice; you are summarizing, not treating.
- Be concise and agent-readable.

Update rules:
- Respond ONLY with JSON that matches the provided schema (no extra keys, no comments, no prose outside JSON).
- Make selective edits; do not rewrite sections that have not changed.
- Never invent facts. Use only oldMemory and today's newData.
- Keep structure and keys stable; preserve unchanged arrays/objects as-is.
- Parts: include all known parts; adjust recency_score and influence_score based on today; update status if warranted.
  - Add a new part only with clear new evidence; do not duplicate existing parts.
- Check-ins: Use morning/evening check-ins to understand the user's daily emotional arc, intentions, and reflections. This data is valuable for updating the summary and identifying active parts.
- Triggers_and_goals: connect entries to related_parts by id; update or append only with new evidence.
- Safety_notes: modify sparingly, only if today's activity clearly requires it.
- Citations are out of scope for this MVP; do not add them.
- Keep the summary brief and updated to reflect meaningful changes; do not restate raw logs.

Output constraints:
- Valid JSON only, strictly conforming to the schema.
- Do not include PII beyond what already exists in inputs.
- Prefer compact wording; use lists over long paragraphs when appropriate.
`;

  const user = {
    oldMemory: params.oldMemory,
    newData: {
      sessions: params.todayData.sessions,
      insights: params.todayData.insights,
      checkIns: params.todayData.checkIns,
    },
    rules: {
      style: 'concise, agent-readable',
      parts: 'include all parts if known; update recency/influence as needed',
      goals: 'tie to parts or triggers when relevant',
      safety: 'update safety_notes only if today warrants changes',
    }
  }

  try {
    const prompt = [
      'Update the memory with selective changes. Respond ONLY with JSON.',
      'Old memory:',
      JSON.stringify(user.oldMemory),
      'New data:',
      JSON.stringify(user.newData),
      'Rules:',
      JSON.stringify(user.rules),
    ].join('\n')

    const { object } = await generateObject({
      model: provider('z-ai/glm-4.5'),
      system,
      prompt,
      schema: userMemorySchema,
      temperature: 0.2,
    })

    const next = object as UserMemory
    // Ensure version increments and last_updated_by present
    return {
      ...next,
      version: Math.max(params.oldMemory.version + 1, next.version || 0),
      last_updated_by: next.last_updated_by || 'summarizer',
    }
  } catch (e) {
    console.error('generateMemoryUpdate error:', e)
    return fallbackUpdate(params.oldMemory)
  }
}

export async function listActiveUsersSince(isoCutoff: string): Promise<string[]> {
  const supabase = createAdminClient()

  // Sessions
  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('user_id')
    .gte('created_at', isoCutoff)

  if (sErr) throw sErr

  // Insights (created or updated)
  const { data: insights, error: iErr } = await supabase
    .from('insights')
    .select('user_id, created_at, updated_at')
    .or(`created_at.gte.${isoCutoff},updated_at.gte.${isoCutoff}`)

  if (iErr) throw iErr

  const { data: checkIns, error: cErr } = await supabase
    .from('check_ins')
    .select('user_id')
    .gte('created_at', isoCutoff)

  if (cErr) throw cErr

  const ids = new Set<string>()
  for (const r of sessions || []) ids.add(r.user_id)
  for (const r of insights || []) ids.add(r.user_id)
  for (const r of checkIns || []) ids.add(r.user_id)
  return [...ids]
}

export async function loadTodayData(userId: string, isoCutoff: string): Promise<TodayData> {
  const supabase = createAdminClient()

  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', isoCutoff)
    .eq('processed', false)
    .order('created_at', { ascending: true })

  if (sErr) throw sErr

  const { data: insights, error: iErr } = await supabase
    .from('insights')
    .select('*')
    .eq('user_id', userId)
    .or(`created_at.gte.${isoCutoff},updated_at.gte.${isoCutoff}`)
    .eq('processed', false)
    .order('created_at', { ascending: true })

  if (iErr) throw iErr

  const { data: checkIns, error: cErr } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', isoCutoff)
    .eq('processed', false)
    .order('created_at', { ascending: true })

  if (cErr) throw cErr

  return { sessions: sessions || [], insights: insights || [], checkIns: checkIns || [] }
}

function extractIds(rows: Record<string, unknown>[] | undefined): string[] {
  if (!rows || rows.length === 0) return []
  return rows
    .map((row) => {
      const id = row['id']
      return typeof id === 'string' && id.length > 0 ? id : null
    })
    .filter((id): id is string => Boolean(id))
}

export async function markUpdatesProcessed(userId: string, items: TodayData): Promise<void> {
  const supabase = createAdminClient()
  const processedAt = new Date().toISOString()

  const updateTable = async (table: 'sessions' | 'insights' | 'check_ins', ids: string[]) => {
    if (ids.length === 0) return
    const { error } = await supabase
      .from(table)
      .update({ processed: true, processed_at: processedAt })
      .in('id', ids)
      .eq('user_id', userId)

    if (error) throw error
  }

  const sessionIds = extractIds(items.sessions)
  const insightIds = extractIds(items.insights)
  const checkInIds = extractIds(items.checkIns)

  await Promise.all([
    updateTable('sessions', sessionIds),
    updateTable('insights', insightIds),
    updateTable('check_ins', checkInIds),
  ])
}
