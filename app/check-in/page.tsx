import { redirect } from 'next/navigation'
import { getUserClient } from '@/lib/supabase/clients'
import { statusForPath } from '@/config/features'
import ComingSoonPage from '@/components/common/ComingSoonPage'
import { dev } from '@/config/dev'

export const dynamic = 'force-dynamic'

export default async function CheckInPage() {
  const feature = statusForPath('/check-in')
  if (feature.status === 'coming_soon') {
    return <ComingSoonPage featureKey={feature.key} />
  }

  const supabase = getUserClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // In development mode, allow bypassing login for faster iteration
  if (!session && !dev.enabled) {
    redirect('/auth/login')
  }

  redirect('/check-in/morning')
}
