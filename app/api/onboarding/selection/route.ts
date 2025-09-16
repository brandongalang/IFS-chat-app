import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'

/**
 * POST /api/onboarding/selection
 * Body: { version: number, ids: string[] }
 * Persists Stage 2 selected question IDs and advances stage to 'stage2' if coming from stage1.
 * Returns 200 with updated state or 409 on version conflict.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)

    const body = await request.json()
    const { version, ids } = body as { version: number; ids: string[] }
    if (!Array.isArray(ids) || typeof version !== 'number') {
      return errorResponse('Invalid request', HTTP_STATUS.BAD_REQUEST)
    }

    // Fetch current state to decide whether to bump stage
    const { data: state } = await supabase
      .from('user_onboarding')
      .select('stage')
      .eq('user_id', user.id)
      .single()

    const update: { stage2_selected_questions: string[]; stage?: string } = { stage2_selected_questions: ids }
    if (state?.stage === 'stage1') update.stage = 'stage2'

    const { data: rows, error } = await supabase
      .from('user_onboarding')
      .update(update)
      .eq('user_id', user.id)
      .eq('version', version)
      .select('*')

    if (error) {
      console.error('selection update error:', error)
      return errorResponse('Failed to save selection', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }

    if (!rows || rows.length === 0) {
      const latest = await supabase
        .from('user_onboarding')
        .select('version')
        .eq('user_id', user.id)
        .single()
      return jsonResponse({ error: 'Version conflict', current_version: latest.data?.version }, HTTP_STATUS.CONFLICT)
    }

    return jsonResponse({ ok: true, state: rows[0] })
  } catch (e) {
    console.error('selection route error:', e)
    return errorResponse('Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
