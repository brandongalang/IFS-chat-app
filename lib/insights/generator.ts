import type { Json } from '@/lib/types/database'
import { SupabaseClient } from '@supabase/supabase-js'

export async function jitTopUpInsights(opts: {
  supabase: SupabaseClient
  userId: string
  needed: number
}): Promise<number> {
  // Only run when explicitly enabled
  if (process.env.IFS_INSIGHTS_JIT !== 'true') return 0
  if (!opts.needed || opts.needed <= 0) return 0

  const now = new Date().toISOString()
  const payloads = Array.from({ length: Math.min(opts.needed, 3) }).map((_, i) => ({
    user_id: opts.userId,
    type: 'observation',
    status: 'pending',
    content: {
      title: 'Daily observation (placeholder)',
      body: 'This is a placeholder insight. JIT generator is enabled.',
      highlights: [],
      sourceSessionIds: []
    } as Json,
    meta: { generator: 'jit-v0', jit: true, slotHint: i, created_via: 'api_get_jit' } as Json,
    created_at: now,
    updated_at: now
  }))

  const { data, error } = await opts.supabase.from('insights').insert(payloads).select('id')
  if (error) {
    console.error('JIT top-up insert failed:', error)
    return 0
  }
  return data?.length || 0
}