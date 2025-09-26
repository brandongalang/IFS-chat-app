import { createClient } from '@/lib/supabase/server'
import { getSupabaseKey, getSupabaseUrl } from '@/lib/supabase/config'

export async function getUserIdFromSupabase(): Promise<string | undefined> {
  const supabaseUrl = getSupabaseUrl()
  const supabaseAnon = getSupabaseKey()
  const hasSupabase =
    typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl) &&
    typeof supabaseAnon === 'string' && supabaseAnon.length > 20

  if (!hasSupabase) {
    return undefined
  }
  try {
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.user?.id
  } catch {
    return undefined
  }
}

export function createDevStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

export function provideDevFallbackStream(text: string): Response {
  return new Response(createDevStream(text), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
