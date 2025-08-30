import { CheckInForm } from '@/components/check-in/CheckInForm'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { statusForPath } from '@/config/features'
import ComingSoonPage from '@/components/common/ComingSoonPage'
import { dev } from '@/config/dev'

export default async function CheckInPage() {
  const feature = statusForPath('/check-in')
  if (feature.status === 'coming_soon') {
    return <ComingSoonPage featureKey={feature.key} />
  }

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // In development mode, allow bypassing login for faster iteration
  if (!session && !dev.enabled) {
    redirect('/auth/login')
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <CheckInForm />
    </div>
  )
}
