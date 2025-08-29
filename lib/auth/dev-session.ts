import { cookies } from 'next/headers'
import { developmentConfig } from '@/mastra/config/development'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'

export function isDevModeActive(): boolean {
  return developmentConfig.enabled === true
}

export async function getEffectiveUserIdServer(): Promise<string | null> {
  if (isDevModeActive()) {
    const cookieStore = await cookies()
    const fromCookie = cookieStore.get('ifs_dev_user_id')?.value
    return fromCookie || developmentConfig.defaultUserId || null
  }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}
