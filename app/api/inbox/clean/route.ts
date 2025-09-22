import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      data: [],
      generatedAt: new Date().toISOString(),
      variant: 'clean',
      message: 'Clean inbox pipeline is not enabled yet. Configure Supabase edge function `inbox_feed`.',
    },
    { status: 501 },
  )
}
