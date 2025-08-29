import { CheckInForm } from '@/components/check-in/CheckInForm'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { statusForPath } from '@/config/features'
import ComingSoonPage from '@/components/common/ComingSoonPage'

export default async function CheckInPage() {
  const feature = statusForPath('/check-in')
  if (feature.status === 'coming_soon') {
    return <ComingSoonPage featureKey={feature.key} />
  }

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <CheckInForm />
    </div>
  )
}
