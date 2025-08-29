import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    // Basic validation
    if (!body.type || (body.type !== 'morning' && body.type !== 'evening')) {
      return NextResponse.json({ error: 'Invalid check-in type' }, { status: 400 })
    }

    const { error, data } = await supabase.from('check_ins').insert({
      user_id: user.id,
      type: body.type,
      mood: body.mood,
      energy_level: body.energy_level,
      intention: body.intention,
      reflection: body.reflection,
      gratitude: body.gratitude,
      parts_data: body.parts_data,
      somatic_markers: body.somatic_markers,
    }).select()

    if (error) {
      console.error('Error inserting check-in:', error)
      // Handle unique constraint violation
      if (error.code === '23505') { // unique_violation
        return NextResponse.json({ error: 'A check-in of this type already exists for this date.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to save check-in' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Check-in API error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
