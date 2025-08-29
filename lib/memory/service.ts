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
    const cp = checkpointRows[0] as any
    base = (cp.full_snapshot_content as UserMemory) || INITIAL_USER_MEMORY
    startVersion = cp.version as number
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
    const ops = (row as any).patch as Operation[]
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
  const last = data && data.length ? (data[0] as any).version as number : 0
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

  const insertPayload: any = {
    user_id: params.userId,
    version,
    patch: patch as any,
    is_full_snapshot: isCheckpoint,
    source_description: params.source || 'daily-update',
  }
  if (isCheckpoint) {
    insertPayload.full_snapshot_content = params.next as any
  }

  const { error } = await supabase.from('user_memory_snapshots').insert(insertPayload)
  if (error) throw error

  return { version, saved: true, isCheckpoint }
}

// Fallback: if model key missing or error, return a light touch update
async function fallbackUpdate(old: UserMemory, _daily: any): Promise<UserMemory> {
  return {
    ...old,
    version: old.version + 1,
    last_updated_by: 'system',
  }
}

export async function generateMemoryUpdate(params: {
  userId: string
  oldMemory: UserMemory
  todayData: { sessions: any[]; insights: any[] }
}): Promise<UserMemory> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return fallbackUpdate(params.oldMemory, params.todayData)

  const provider = createOpenRouter({ apiKey })

  // Keep prompt compact but instructive for an MVP
  const system = `You update a user's long-term memory summary. Respond ONLY with JSON matching the provided schema. Make selective edits; do not regenerate unchanged sections.`

  const user = {
    oldMemory: params.oldMemory,
    newData: {
      sessions: params.todayData.sessions,
      insights: params.todayData.insights,
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
    return fallbackUpdate(params.oldMemory, params.todayData)
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

  const ids = new Set<string>()
  for (const r of sessions || []) ids.add((r as any).user_id)
  for (const r of insights || []) ids.add((r as any).user_id)
  return [...ids]
}

export async function loadTodayData(userId: string, isoCutoff: string): Promise<{ sessions: any[]; insights: any[] }> {
  const supabase = createAdminClient()

  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', isoCutoff)
    .order('created_at', { ascending: true })

  if (sErr) throw sErr

  const { data: insights, error: iErr } = await supabase
    .from('insights')
    .select('*')
    .eq('user_id', userId)
    .or(`created_at.gte.${isoCutoff},updated_at.gte.${isoCutoff}`)
    .order('created_at', { ascending: true })

  if (iErr) throw iErr

  return { sessions: sessions || [], insights: insights || [] }
}

