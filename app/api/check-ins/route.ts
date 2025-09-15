import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dev, resolveUserId } from '@/config/dev'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export async function POST(req: NextRequest) {
  // In dev mode, if a service role key is available, use admin client and a dev user id
  const useAdmin = dev.enabled && !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = useAdmin ? createAdminClient() : await createClient()

  let effectiveUserId: string | null = null

  if (useAdmin) {
    // Resolve a deterministic dev user ID (persona or default)
    try {
      effectiveUserId = resolveUserId()
    } catch {
      // Fall back to rejecting if no dev user can be resolved
      return NextResponse.json({ error: 'Dev user not configured. Set IFS_TEST_PERSONA or IFS_DEFAULT_USER_ID.' }, { status: 400 })
    }
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    effectiveUserId = user.id
  }

  try {
    const body = await req.json()

    // Basic validation
    if (!body.type || (body.type !== 'morning' && body.type !== 'evening')) {
      return NextResponse.json({ error: 'Invalid check-in type' }, { status: 400 })
    }

    const rawResponses: unknown = body.responses
    const responses = isRecord(rawResponses) ? { ...rawResponses } : {}

    const getString = (value: unknown) => (typeof value === 'string' ? value : null)
    const getResponseString = (key: string) => getString(responses[key])

    const intentionFromBody = getString(body.intention)
    const reflectionFromBody = getString(body.reflection)
    const gratitudeFromBody = getString(body.gratitude)

    const intentionValue = intentionFromBody ?? getResponseString('intention')

    const reflectionValue =
      reflectionFromBody ?? (body.type === 'evening' ? getResponseString('reflectionOnIntention') : null)

    const gratitudeValue = gratitudeFromBody ?? getResponseString('gratitude')

    const rawPartsData: unknown = body.parts_data
    const basePartsData = isRecord(rawPartsData) ? rawPartsData : {}
    const partsData = {
      ...basePartsData,
      daily_responses: {
        variant: body.type,
        ...responses,
      },
    }

    const { error, data } = await supabase.from('check_ins').insert({
      user_id: effectiveUserId,
      type: body.type,
      mood: body.mood,
      energy_level: body.energy_level,
      intention: intentionValue ?? null,
      reflection: reflectionValue ?? null,
      gratitude: gratitudeValue ?? null,
      parts_data: partsData,
      somatic_markers: body.somatic_markers,
      processed: false,
    }).select()

    if (error) {
      console.error('Error inserting check-in:', error)
      // Handle unique constraint violation
      const pgCode = (error as { code?: string } | null)?.code
      if (pgCode === '23505') { // unique_violation
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
