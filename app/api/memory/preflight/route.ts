import { getUserClient } from '@/lib/supabase/clients'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { hasPendingUpdates } from '@/lib/memory/updates'
import { summarizePendingUpdates } from '@/lib/services/memory'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = getUserClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('Error resolving user for memory preflight:', authError)
    }

    if (!user) {
      return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
    }

    try {
      const pending = await hasPendingUpdates(user.id)
      if (!pending) {
        return jsonResponse({ ok: true, processed: 0, pending: false })
      }

      const outcome = await summarizePendingUpdates({ userId: user.id, limit: 25 })
      return jsonResponse({ ok: true, processed: outcome.processed, pending: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown-error'
      console.warn('[memory] preflight summarization failed', {
        userId: user.id,
        error: message,
      })
      return jsonResponse({ ok: false, processed: 0, pending: true, error: message })
    }
  } catch (error) {
    console.error('Unexpected error in memory preflight route:', error)
    return errorResponse('Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
