import { NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { dev } from '@/config/dev'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { searchParts } from '@/lib/data/parts-server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('Supabase auth error while fetching parts:', authError)
  }

  if (!user && !dev.enabled) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  const params = request.nextUrl.searchParams
  const limitParam = params.get('limit')
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined
  const limit = typeof parsedLimit === 'number' && !Number.isNaN(parsedLimit) ? parsedLimit : undefined

  type SearchPartsInput = Parameters<typeof searchParts>[0]
  const searchInput: Partial<SearchPartsInput> = {
    query: params.get('query') ?? undefined,
    userId: user?.id,
  }

  const statusParam = params.get('status')
  if (statusParam) {
    searchInput.status = statusParam as SearchPartsInput['status']
  }

  const categoryParam = params.get('category')
  if (categoryParam) {
    searchInput.category = categoryParam as SearchPartsInput['category']
  }

  if (typeof limit === 'number') {
    searchInput.limit = limit as SearchPartsInput['limit']
  }

  try {
    const parts = await searchParts(searchInput as SearchPartsInput)
    return jsonResponse(parts)
  } catch (error) {
    if (error instanceof ZodError) {
      const detail = error.issues.map(issue => issue.message).join(', ') || 'Invalid request parameters'
      return errorResponse(`Invalid request: ${detail}`, HTTP_STATUS.BAD_REQUEST)
    }

    console.error('Error fetching parts:', error)
    return errorResponse('Failed to fetch parts', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
