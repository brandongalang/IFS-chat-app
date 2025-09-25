import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseKey, getSupabaseUrl } from '@/lib/supabase/config'
import { jsonResponse, errorResponse } from '@/lib/api/response'
import { readJsonBody, isRecord } from '@/lib/api/request'

const supabaseUrl = getSupabaseUrl()
const supabaseAnon = getSupabaseKey()
const hasSupabase =
  typeof supabaseUrl === 'string' &&
  /^https?:\/\//.test(supabaseUrl || '') &&
  typeof supabaseAnon === 'string' &&
  (supabaseAnon || '').length > 20

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const raw = await readJsonBody(req)
    if (!id || !isRecord(raw) || !('rating' in raw)) {
      return errorResponse('rating is required', 400)
    }

    const rating = raw.rating
    const feedback = typeof raw.feedback === 'string' ? raw.feedback : null

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
  } catch (error) {
    console.error('POST /api/insights/[id]/feedback error:', error)
    return errorResponse('Failed to submit feedback', 500)
  }
}
