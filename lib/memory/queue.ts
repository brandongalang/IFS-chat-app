import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

export type MemoryUpdateKind = 'session' | 'check_in' | 'onboarding' | 'inbox_action' | 'manual'

const enqueueInputSchema = z.object({
  userId: z.string().uuid(),
  kind: z.union([
    z.literal('session'),
    z.literal('check_in'),
    z.literal('onboarding'),
    z.literal('inbox_action'),
    z.literal('manual'),
  ]),
  refId: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type EnqueueMemoryUpdateInput = z.infer<typeof enqueueInputSchema>

export type EnqueueMemoryUpdateResult = {
  inserted: boolean
  id?: string
  error?: string
}

export async function enqueueMemoryUpdate(
  input: EnqueueMemoryUpdateInput,
): Promise<EnqueueMemoryUpdateResult> {
  const parsed = enqueueInputSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues?.map((issue) => issue.message).join(', ') ?? 'invalid input'
    return { inserted: false, error: issues }
  }

  const supabase = createAdminClient()
  const payload: Record<string, unknown> = parsed.data.payload ? { ...parsed.data.payload } : {}
  const metadata: Record<string, unknown> = {
    refId: parsed.data.refId,
    ...(parsed.data.metadata ? { ...parsed.data.metadata } : {}),
  }

  const { data, error } = await supabase
    .from('memory_updates')
    .upsert(
      [
        {
          user_id: parsed.data.userId,
          kind: parsed.data.kind,
          ref_id: parsed.data.refId,
          payload,
          metadata,
        },
      ],
      {
        onConflict: 'user_id,kind,ref_id',
        ignoreDuplicates: true,
      },
    )
    .select('id')

  if (error) {
    console.warn('[memory_updates] enqueue failed', {
      userId: parsed.data.userId,
      kind: parsed.data.kind,
      refId: parsed.data.refId,
      error: error.message,
    })
    return { inserted: false, error: error.message }
  }

  const insertedId = Array.isArray(data) && data.length > 0 ? data[0]?.id : undefined
  return { inserted: Boolean(insertedId), id: insertedId }
}
