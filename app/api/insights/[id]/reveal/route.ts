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

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    if (!id) {
      return new Response(JSON.stringify({ error: 'id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!hasSupabase) {
      return new Response(JSON.stringify({ ok: true, updated: false }), {
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

    if (current.status === 'revealed' || current.status === 'actioned') {
      return new Response(JSON.stringify(current), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: updated, error } = await supabase
      .from('insights')
      .update({ status: 'revealed', revealed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('POST /api/insights/[id]/reveal error:', e)
    return new Response(JSON.stringify({ error: 'Failed to reveal insight' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

