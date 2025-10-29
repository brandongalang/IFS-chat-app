import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic' // Prevents caching

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-vercel-cron-secret')
  
  // Show first 10 chars of secrets for debugging (never show full secrets!)
  const cronSecret = process.env.CRON_SECRET
  const cronSecretPreview = cronSecret ? cronSecret.substring(0, 10) + '...' : 'NOT_SET'
  
  const authHeaderPreview = authHeader ? authHeader.substring(0, Math.min(20, authHeader.length)) + '...' : 'NOT_PRESENT'
  const cronHeaderPreview = cronHeader ? cronHeader.substring(0, Math.min(15, cronHeader.length)) + '...' : 'NOT_PRESENT'
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      CRON_SECRET_set: !!process.env.CRON_SECRET,
      CRON_SECRET_preview: cronSecretPreview,
      CRON_SECRET_length: process.env.CRON_SECRET?.length || 0,
    },
    request_headers: {
      authorization_present: !!authHeader,
      authorization_preview: authHeaderPreview,
      authorization_expected_start: `Bearer ${cronSecretPreview}`,
      x_vercel_cron_secret_present: !!cronHeader,
      x_vercel_cron_secret_preview: cronHeaderPreview,
      x_vercel_cron_secret_expected_start: cronSecretPreview,
    },
    validation: {
      auth_header_matches: authHeader === `Bearer ${cronSecret}`,
      cron_header_matches: cronHeader === cronSecret,
      should_pass: authHeader === `Bearer ${cronSecret}` || cronHeader === cronSecret
    }
  })
}
