import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dev, resolveUserId } from '@/config/dev'

type DailyResponses = Partial<{
  intention: string
  worries: string
  lookingForwardTo: string
  reflectionOnIntention: string
  reflectionOnWorries: string
  reflectionOnLookingForwardTo: string
}>

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

    const responses: DailyResponses | null =
      body.responses && typeof body.responses === 'object' && !Array.isArray(body.responses)
        ? (body.responses as DailyResponses)
        : null

    const basePartsData =
      body.parts_data && typeof body.parts_data === 'object' && !Array.isArray(body.parts_data)
        ? (body.parts_data as Record<string, unknown>)
        : null

    const combinedPartsData =
      basePartsData || responses
        ? {
            ...(basePartsData ?? {}),
            ...(responses ? { daily_responses: { variant: body.type, ...responses } } : {}),
          }
        : null

    const insertData: Record<string, unknown> = {
      user_id: effectiveUserId,
      type: body.type,
    }

    if (typeof body.mood === 'number') {
      insertData.mood = body.mood
    }

    if (typeof body.energy_level === 'number') {
      insertData.energy_level = body.energy_level
    }

    const intentionValue =
      typeof body.intention === 'string'
        ? body.intention
        : body.type === 'morning' && responses?.intention
        ? responses.intention
        : null

    if (intentionValue !== null && intentionValue !== undefined) {
      insertData.intention = intentionValue
    }

    const reflectionValue =
      typeof body.reflection === 'string'
        ? body.reflection
        : body.type === 'evening' && responses?.reflectionOnIntention
        ? responses.reflectionOnIntention
        : null

    if (reflectionValue !== null && reflectionValue !== undefined) {
      insertData.reflection = reflectionValue
    }

    if (typeof body.gratitude === 'string') {
      insertData.gratitude = body.gratitude
    }

    if (combinedPartsData) {
      insertData.parts_data = combinedPartsData
    }

    if (Array.isArray(body.somatic_markers)) {
      insertData.somatic_markers = body.somatic_markers
    }

    const { error, data } = await supabase.from('check_ins').insert(insertData).select()

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
