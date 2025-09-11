import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jitTopUpInsights } from '@/lib/insights/generator'
import { jsonResponse, errorResponse } from '@/lib/api/response'

const hasSupabase =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
  /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '') &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' &&
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length > 20

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const limitRaw = parseInt(url.searchParams.get('limit') || '3', 10)
    const limit = Math.max(1, Math.min(3, isNaN(limitRaw) ? 3 : limitRaw))
    const includeStatusParam = url.searchParams.get('includeStatus') || 'pending,revealed'
    const statuses = includeStatusParam
      .split(',')
      .map(s => s.trim())
      .filter(s => ['pending','revealed','actioned'].includes(s))
      .filter(s => s === 'pending' || s === 'revealed')
    const jit = (url.searchParams.get('jit') || '').toLowerCase() === 'true'

    if (!hasSupabase) {
      const sample = [
        {
          id: 'dev-insight-1',
          type: 'observation',
          status: 'pending',
          content: { title: 'Dev Insight', body: 'OPENROUTER_API_KEY\/Supabase not configured; this is a sample.' },
          rating: null,
          feedback: null,
          revealed_at: null,
          actioned_at: null,
          meta: { dev: true },
          created_at: new Date().toISOString(),
        },
      ]
      return jsonResponse(sample.slice(0, limit))
    }

    const supabase = await createClient()

    let userId: string | null = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id || null
    } catch {
      userId = null
    }

if (!userId) {
      // In dev persona mode, fall back to default user ID for API access when not authenticated
      const { dev } = await import('@/config/dev')
      if (dev.enabled && dev.defaultUserId) {
        userId = dev.defaultUserId
      } else {
        return errorResponse('Unauthorized', 401)
      }
    }

    if (jit && process.env.IFS_INSIGHTS_JIT === 'true') {
      const { count } = await supabase
        .from('insights')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['pending','revealed'])
      const activeCount = typeof count === 'number' ? count : 0
      const needed = Math.max(0, limit - activeCount)
      if (needed > 0) {
        await jitTopUpInsights({ supabase, userId, needed })
      }
    }

    const { data, error } = await supabase
      .from('insights')
      .select('id,type,status,content,rating,feedback,revealed_at,actioned_at,created_at,meta')
      .eq('user_id', userId)
      .in('status', statuses.length ? statuses : ['pending','revealed'])
      .order('created_at', { ascending: true })
    if (error) throw error

    const sorted = (data || [])
      .sort((a: { status: string; created_at: string }, b: { status: string; created_at: string }) => {
        const aw = a.status === 'revealed' ? 0 : 1
        const bw = b.status === 'revealed' ? 0 : 1
        if (aw !== bw) return aw - bw
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      .slice(0, limit)

    return jsonResponse(sorted)
  } catch (e) {
    console.error('GET /api/insights error:', e)
    return errorResponse('Failed to fetch insights', 500)
  }
}

