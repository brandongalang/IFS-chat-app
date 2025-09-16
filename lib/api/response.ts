import { NextResponse } from 'next/server'

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS]

export function jsonResponse(data: unknown, status: HttpStatusCode = HTTP_STATUS.OK, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  return new NextResponse(JSON.stringify(data), { ...init, status, headers })
}

export function errorResponse(
  message: string,
  status: HttpStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  init?: ResponseInit
) {
  return jsonResponse({ error: message }, status, init)
}
