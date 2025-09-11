import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonResponse, errorResponse } from '@/lib/api/response'

const hasSupabase =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
  /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '') &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' &&
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length > 20

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    if (!id) {
      return errorResponse('id is required', 400)
    }

    if (!hasSupabase) {
      return jsonResponse({ ok: true, updated: false })
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

    if (current.status === 'revealed' || current.status === 'actioned') {
      return jsonResponse(current)
    }

    const { data: updated, error } = await supabase
      .from('insights')
      .update({ status: 'revealed', revealed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return jsonResponse(updated)
  } catch (e) {
    console.error('POST /api/insights/[id]/reveal error:', e)
    return errorResponse('Failed to reveal insight', 500)
  }
}

