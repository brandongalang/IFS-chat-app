import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { sessionId, messageId, rating, explanation } = await req.json()

    if (!sessionId || !messageId || !rating) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    if (rating !== 'thumb_up' && rating !== 'thumb_down') {
        return new NextResponse(
            JSON.stringify({ error: 'Invalid rating' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          )
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
      return new NextResponse(
        JSON.stringify({ error: 'Failed to save feedback' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Feedback API error:', error)
    return new NextResponse(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
