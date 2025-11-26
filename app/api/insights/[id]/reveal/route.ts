import { NextRequest } from 'next/server'
import { getUserClient } from '@/lib/supabase/clients'
import { getSupabaseKey, getSupabaseUrl } from '@/lib/supabase/config'
import { jsonResponse, errorResponse } from '@/lib/api/response'

const supabaseUrl = getSupabaseUrl()
const supabaseAnon = getSupabaseKey()
const hasSupabase =
  typeof supabaseUrl === 'string' &&
  /^https?:\/\//.test(supabaseUrl || '') &&
  typeof supabaseAnon === 'string' &&
  (supabaseAnon || '').length > 20

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    if (!id) {
      return errorResponse('id is required', 400)
    }

    if (!hasSupabase) {
      return jsonResponse({ ok: true, updated: false })
    }

    const supabase = await getUserClient()

    const { data: current, error: fetchErr } = await supabase
      .from('inbox_items')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr) {
      return errorResponse('Not found', 404)
    }

    if (current.status === 'revealed' || current.status === 'actioned') {
      return jsonResponse(current)
    }

    const { data: updated, error } = await supabase
      .from('inbox_items')
      .update({ status: 'revealed', revealed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return jsonResponse(updated)
  } catch (error) {
    console.error('POST /api/insights/[id]/reveal error:', error)
    return errorResponse('Failed to reveal insight', 500)
  }
}
