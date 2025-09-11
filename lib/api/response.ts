export function jsonResponse(data: unknown, status = 200, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), { ...init, status, headers })
}

export function errorResponse(message: string, status = 500, init?: ResponseInit) {
  return jsonResponse({ error: message }, status, init)
}
