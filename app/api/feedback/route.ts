import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonResponse, errorResponse } from '@/lib/api/response'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    const { sessionId, messageId, rating, explanation } = await req.json()

    if (!sessionId || !messageId || !rating) {
      return errorResponse('Missing required fields', 400)
    }

    if (rating !== 'thumb_up' && rating !== 'thumb_down') {
      return errorResponse('Invalid rating', 400)
    }

    const { error } = await supabase.from('message_feedback').insert({
      session_id: sessionId,
      message_id: messageId,
      user_id: user.id,
      rating: rating,
      explanation: explanation,
    })

    if (error) {
      console.error('Error inserting feedback:', error)
      return errorResponse('Failed to save feedback', 500)
    }

    return jsonResponse({ success: true })
  } catch (error) {
    console.error('Feedback API error:', error)
    return errorResponse('An unexpected error occurred', 500)
  }
}
