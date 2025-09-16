import { NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { dev } from '@/config/dev'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { getPartById } from '@/lib/data/parts-server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = {
  params: {
    partId: string
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { partId } = context.params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('Supabase auth error while fetching part:', authError)
  }

  if (!user && !dev.enabled) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  try {
    const part = await getPartById({ partId, userId: user?.id })

    if (!part) {
      return errorResponse('Part not found', HTTP_STATUS.NOT_FOUND)
    }

    return jsonResponse(part)
  } catch (error) {
    if (error instanceof ZodError) {
      const detail = error.issues.map(issue => issue.message).join(', ') || 'Invalid request parameters'
      return errorResponse(`Invalid request: ${detail}`, HTTP_STATUS.BAD_REQUEST)
    }

    console.error(`Error fetching part ${partId}:`, error)
    return errorResponse('Failed to fetch part', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
