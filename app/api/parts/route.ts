import { getUserClient } from '@/lib/supabase/clients'
import { listPartDisplayRecords } from '@/lib/data/schema/server'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'

export async function GET() {
  const supabase = getUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
  }

  try {
    const displayRows = await listPartDisplayRecords(
      { client: supabase, userId: user.id },
      null, // fetch all parts (no limit)
    )
    return jsonResponse(displayRows)
  } catch (error) {
    console.error('Parts API error:', error)
    return errorResponse('An unexpected error occurred', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
