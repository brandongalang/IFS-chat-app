import { NextRequest } from 'next/server'
import { ZodError } from 'zod'

import { dev } from '@/config/dev'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { getPartRelationships } from '@/lib/data/parts-server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('Supabase auth error while fetching part relationships:', authError)
  }

  if (!user && !dev.enabled) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  const params = request.nextUrl.searchParams
  const limitParam = params.get('limit')
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined
  const limit = typeof parsedLimit === 'number' && !Number.isNaN(parsedLimit) ? parsedLimit : undefined

  type RelationshipsInput = Parameters<typeof getPartRelationships>[0]
  const relationshipInput: Partial<RelationshipsInput> = {
    userId: user?.id,
  }

  const partIdParam = params.get('partId')
  if (partIdParam) {
    relationshipInput.partId = partIdParam as RelationshipsInput['partId']
  }

  const relationshipTypeParam = params.get('relationshipType')
  if (relationshipTypeParam) {
    relationshipInput.relationshipType = relationshipTypeParam as RelationshipsInput['relationshipType']
  }

  const statusParam = params.get('status')
  if (statusParam) {
    relationshipInput.status = statusParam as RelationshipsInput['status']
  }

  const includePartDetailsParam = params.get('includePartDetails')
  if (includePartDetailsParam !== null) {
    relationshipInput.includePartDetails = (includePartDetailsParam === 'true') as RelationshipsInput['includePartDetails']
  }

  if (typeof limit === 'number') {
    relationshipInput.limit = limit as RelationshipsInput['limit']
  }

  try {
    const relationships = await getPartRelationships(relationshipInput as RelationshipsInput)
    return jsonResponse(relationships)
  } catch (error) {
    if (error instanceof ZodError) {
      const detail = error.issues.map(issue => issue.message).join(', ') || 'Invalid request parameters'
      return errorResponse(`Invalid request: ${detail}`, HTTP_STATUS.BAD_REQUEST)
    }

    console.error('Error fetching part relationships:', error)
    return errorResponse('Failed to fetch part relationships', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
