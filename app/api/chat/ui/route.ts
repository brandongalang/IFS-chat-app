// DEPRECATED: This endpoint is no longer in use. Please POST to /api/chat instead.
// Returning 410 Gone to signal clients to migrate.
import { jsonResponse } from '@/lib/api/response'

export async function POST() {
  return jsonResponse(
    {
      error: 'Deprecated endpoint',
      message: 'Use /api/chat instead. This route has been superseded by the unified chat endpoint.'
    },
    410,
    { headers: { Deprecation: 'true', Link: '</api/chat>; rel="successor-version"' } }
  )
}
