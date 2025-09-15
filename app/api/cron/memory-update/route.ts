import { NextResponse } from 'next/server'
import { listActiveUsersSince, reconstructMemory, loadTodayData, generateMemoryUpdate, saveNewSnapshot, markUpdatesProcessed } from '@/lib/memory/service'

function requireCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // In dev, allow if not configured; in prod, CI should set CRON_SECRET
    return process.env.NODE_ENV !== 'production'
  }
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
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
      await markUpdatesProcessed(userId, today)
      results.push({ userId, version: saved.version })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'unknown-error'
      results.push({ userId, error: message })
    }
  }

  return NextResponse.json({ cutoff, processed: users.length, results })
}

export async function GET(req: Request) {
  if (!requireCronAuth(req)) return new NextResponse('Unauthorized', { status: 401 })
  try {
    return await runDailyMemoryUpdate()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Error'
    return new NextResponse(message, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!requireCronAuth(req)) return new NextResponse('Unauthorized', { status: 401 })
  try {
    return await runDailyMemoryUpdate()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Error'
    return new NextResponse(message, { status: 500 })
  }
}

