import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonResponse, errorResponse } from '@/lib/api/response'

const hasSupabase =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
  /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '') &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' &&
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length > 20

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { rating, feedback } = await req.json().catch(() => ({}))

    if (!id || typeof rating === 'undefined') {
      return errorResponse('rating is required', 400)
    }

    if (!hasSupabase) {
      return jsonResponse({ ok: true, stored: false })
    }

    const supabase = await createClient()

    const { data: current, error: fetchErr } = await supabase
      .from('insights')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr) {
      return errorResponse('Not found', 404)
    }

    const updates: Record<string, unknown> = { rating, feedback }
    if (current.status !== 'actioned') {
      updates.status = 'actioned'
      updates.actioned_at = new Date().toISOString()
    }

    const { data: updated, error } = await supabase
      .from('insights')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return jsonResponse(updated)
  } catch (e) {
    console.error('POST /api/insights/[id]/feedback error:', e)
    return errorResponse('Failed to submit feedback', 500)
  }
}

