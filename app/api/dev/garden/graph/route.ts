import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getPersonaUserId, type TestPersona } from '@/config/personas'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED: TestPersona[] = ['beginner','moderate','advanced']

function resolveUserIdFromCookieOrEnv(): string | null {
  // Try cookie first
  try {
    const c = cookies()
    const persona = c.get('ifs-test-persona')?.value
    if (persona && ALLOWED.includes(persona as TestPersona)) {
      const uid = getPersonaUserId(persona as TestPersona)
      if (uid) return uid
    }
  } catch {}
  // Fallback to env
  const envPersona = (process.env.IFS_TEST_PERSONA || 'beginner') as TestPersona
  if (ALLOWED.includes(envPersona)) {
    const uid = getPersonaUserId(envPersona)
    if (uid) return uid
  }
  const def = process.env.IFS_DEFAULT_USER_ID || null
  return def || null
}

export async function GET() {
  const userId = resolveUserIdFromCookieOrEnv()
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'no_user' }, { status: 400 })
  }
  try {
    const supabase = createAdminClient()

    const [{ data: parts, error: partsErr }, { data: rels, error: relsErr }] = await Promise.all([
      supabase.from('parts').select('*').eq('user_id', userId).order('last_active', { ascending: false }).limit(200),
      supabase.from('part_relationships').select('*').eq('user_id', userId).limit(200)
    ])

    if (partsErr) return NextResponse.json({ ok: false, error: partsErr.message }, { status: 500 })
    if (relsErr) return NextResponse.json({ ok: false, error: relsErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, parts: parts || [], relationships: rels || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
