import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const hasSupabase =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
  /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '') &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' &&
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length > 20

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
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

    const updates: Record<string, any> = { rating, feedback }
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

