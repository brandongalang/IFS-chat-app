import { getUserClient } from '@/lib/supabase/clients'
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
    const { data: parts, error } = await supabase
      .from('parts')
      .select('id, name, visualization')
      .eq('user_id', user.id)
      .order('last_active', { ascending: false })

    if (error) {
      console.error('Error fetching parts:', error)
      return errorResponse('Failed to fetch parts', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }

    return jsonResponse(parts)
  } catch (error) {
    console.error('Parts API error:', error)
    return errorResponse('An unexpected error occurred', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
