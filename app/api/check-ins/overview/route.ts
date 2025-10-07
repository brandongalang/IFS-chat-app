import { NextRequest } from 'next/server'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'
import { loadCheckInOverview } from '@/lib/check-ins/server'
import { parseIsoDate, toLocalDateIso } from '@/lib/check-ins/shared'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const targetDateParam = searchParams.get('date')

  let targetDateIso: string
  if (targetDateParam && targetDateParam.length > 0) {
    try {
      targetDateIso = toLocalDateIso(parseIsoDate(targetDateParam))
    } catch {
      return errorResponse('Invalid date parameter', HTTP_STATUS.BAD_REQUEST)
    }
  } else {
    targetDateIso = toLocalDateIso(new Date())
  }

  try {
    const overview = await loadCheckInOverview(targetDateIso)
    return jsonResponse(overview, HTTP_STATUS.OK)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
      }
      if (error.message.includes('Dev user not configured')) {
        return errorResponse(error.message, HTTP_STATUS.BAD_REQUEST)
      }
    }
    console.error('Failed to load check-in overview', error)
    return errorResponse('Failed to load check-ins', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
