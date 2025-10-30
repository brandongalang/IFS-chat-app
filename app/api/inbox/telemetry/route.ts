import { NextRequest } from 'next/server'
import { getUserClient } from '@/lib/supabase/clients'
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response'

export async function GET(_req: NextRequest) {
  const userSupabase = getUserClient()
  const { data: auth } = await userSupabase.auth.getUser()
  const user = auth.user
  if (!user) return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)

  const { data, error } = await userSupabase
    .from('inbox_observation_telemetry')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return errorResponse('Failed to load telemetry', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }

  return jsonResponse({ telemetry: data ?? [] })
}

