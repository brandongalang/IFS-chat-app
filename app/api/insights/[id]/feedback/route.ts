import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseKey, getSupabaseUrl } from '@/lib/supabase/config'

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
    const { rating, feedback } = await req.json().catch(() => ({}))

    if (!id || typeof rating === 'undefined') {
      return new Response(JSON.stringify({ error: 'rating is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!hasSupabase) {
      return new Response(JSON.stringify({ ok: true, stored: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = await createClient()

    const { data: current, error: fetchErr } = await supabase
      .from('insights')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
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

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('POST /api/insights/[id]/feedback error:', e)
    return new Response(JSON.stringify({ error: 'Failed to submit feedback' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

