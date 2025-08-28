// DEPRECATED: This endpoint is no longer in use. Please POST to /api/chat instead.
// Returning 410 Gone to signal clients to migrate.

export async function POST() {
  return new Response(
    JSON.stringify({
      error: 'Deprecated endpoint',
      message: 'Use /api/chat instead. This route has been superseded by the unified chat endpoint.'
    }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        'Deprecation': 'true',
        'Link': '</api/chat>; rel="successor-version"'
      }
    }
  )
}
