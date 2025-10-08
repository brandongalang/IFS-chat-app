import { NextRequest } from 'next/server'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { submitCheckIn } from '@/lib/check-ins/server'
import { parseIsoDate, toLocalDateIso } from '@/lib/check-ins/shared'

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()

    if (!json?.type || (json.type !== 'morning' && json.type !== 'evening')) {
      return errorResponse('Invalid check-in type', HTTP_STATUS.BAD_REQUEST)
    }

    if (json.targetDateIso) {
      try {
        json.targetDateIso = toLocalDateIso(parseIsoDate(json.targetDateIso))
      } catch {
        return errorResponse('Invalid target date', HTTP_STATUS.BAD_REQUEST)
      }
    }

    const result = await submitCheckIn(json)
    const status = result.conflict ? HTTP_STATUS.CONFLICT : HTTP_STATUS.CREATED
    if (result.conflict) {
      return errorResponse('A check-in of this type already exists for this date.', status)
    }
    return jsonResponse(result.data ?? [], status)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
      }
      if (error.message.includes('Dev user not configured')) {
        return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST)
      }
    }
    console.error('Check-in API error:', error)
    return errorResponse('An unexpected error occurred', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
