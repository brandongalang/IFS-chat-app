import { NextResponse } from 'next/server'
import { DAY_MS } from '@/config/time'
import { requireCronAuth } from '@/lib/api/cron-auth'
import { listActiveUsersSince, reconstructMemory, loadTodayData, generateMemoryUpdate, saveNewSnapshot, markUpdatesProcessed } from '@/lib/memory/service'

async function runDailyMemoryUpdate(): Promise<Response> {
  const cutoff = new Date(Date.now() - DAY_MS).toISOString()
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
