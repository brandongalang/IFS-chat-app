import { getServiceClient, type SupabaseDatabaseClient } from '@/lib/supabase/clients'

import type { ObservationTelemetryClient, ObservationTelemetryEvent } from './types'

const TABLE_NAME = 'inbox_observation_telemetry'

export function createObservationTelemetryClient(
  client?: SupabaseDatabaseClient,
): ObservationTelemetryClient {
  const supabase = client ?? getServiceClient()

  return {
    async record(event: ObservationTelemetryEvent): Promise<void> {
      if (process.env.NODE_ENV === 'test') {
        return
      }

      try {
        const payload = {
          user_id: event.userId,
          tool: event.tool,
          duration_ms: Math.max(0, Math.round(event.durationMs)),
          metadata: event.metadata ?? {},
          error: event.error ?? null,
        }

        const { error } = await supabase.from(TABLE_NAME).insert(payload)
        if (error && process.env.NODE_ENV !== 'production') {
          console.error('[ObservationTelemetry] insert failed', error)
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[ObservationTelemetry] unexpected failure', error)
        }
      }
    },
  }
}
