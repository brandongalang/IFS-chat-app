import { NextResponse } from 'next/server'
import { listActiveUsersSince, reconstructMemory, loadTodayData, generateMemoryUpdate, saveNewSnapshot } from '@/lib/memory/service'

function requireCronAuth(req: Request): boolean {
  const configured = process.env.CRON_SECRET
  if (!configured) {
    // In dev, allow if not configured; in prod, CI should set CRON_SECRET
    return process.env.NODE_ENV !== 'production'
  }
  const header = req.headers.get('x-cron-key') || req.headers.get('x-cron-secret')
  return header === configured
}

async function runDailyMemoryUpdate(): Promise<Response> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const users = await listActiveUsersSince(cutoff)

  const results: Array<{ userId: string; version?: number; error?: string }> = []

  for (const userId of users) {
    try {
      const previous = await reconstructMemory(userId)
      const today = await loadTodayData(userId, cutoff)
      // If no activity payloads found, skip to avoid bumping version unnecessarily
      if ((today.sessions?.length || 0) + (today.insights?.length || 0) === 0) {
        results.push({ userId, error: 'no-activity' })
        continue
      }
      const next = await generateMemoryUpdate({ userId, oldMemory: previous, todayData: today })
      const saved = await saveNewSnapshot({ userId, previous, next, source: 'cron-daily' })
      results.push({ userId, version: saved.version })
    } catch (e: any) {
      results.push({ userId, error: e?.message || 'unknown-error' })
    }
  }

  return NextResponse.json({ cutoff, processed: users.length, results })
}

export async function GET(req: Request) {
  if (!requireCronAuth(req)) return new NextResponse('Unauthorized', { status: 401 })
  try {
    return await runDailyMemoryUpdate()
  } catch (e: any) {
    return new NextResponse(e?.message || 'Internal Error', { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!requireCronAuth(req)) return new NextResponse('Unauthorized', { status: 401 })
  try {
    return await runDailyMemoryUpdate()
  } catch (e: any) {
    return new NextResponse(e?.message || 'Internal Error', { status: 500 })
  }
}

