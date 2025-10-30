import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database'

type Supabase = SupabaseClient<Database>

export type InboxTelemetryPayload = {
  userId: string
  tool: string
  durationMs?: number
  metadata?: Record<string, unknown>
  error?: string | null
}

export async function logInboxTelemetry(
  supabase: Supabase,
  payload: InboxTelemetryPayload,
): Promise<void> {
  try {
    await supabase.from('inbox_observation_telemetry').insert({
      user_id: payload.userId,
      tool: payload.tool,
      duration_ms: typeof payload.durationMs === 'number' ? payload.durationMs : 0,
      metadata: (payload.metadata ?? {}) as Json,
      error: payload.error ?? null,
    })
  } catch (error) {
    // Best-effort: avoid throwing inside logging path
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[inbox] telemetry insert failed', error)
    }
  }
}
