import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { statusForPath } from '@/config/features'
import ComingSoonPage from '@/components/common/ComingSoonPage'
import { dev } from '@/config/dev'

type CheckInVariant = 'morning' | 'evening'
type TimeOfDay = CheckInVariant | 'none'

function resolveTimeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours()
  if (hour >= 4 && hour < 12) {
    return 'morning'
  }
  if (hour >= 16 && hour < 22) {
    return 'evening'
  }
  return 'none'
}

function determineVariant({
  timeOfDay,
  hasMorning,
  hasEvening,
}: {
  timeOfDay: TimeOfDay
  hasMorning: boolean
  hasEvening: boolean
}): CheckInVariant {
  if (hasMorning) {
    return timeOfDay === 'evening' ? 'evening' : 'morning'
  }

  if (hasEvening) {
    return 'morning'
  }

  return timeOfDay === 'evening' ? 'evening' : 'morning'
}

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

  const now = new Date()
  const timeOfDay = resolveTimeOfDay(now)
  let variant: CheckInVariant = timeOfDay === 'evening' ? 'evening' : 'morning'

  const userId = session?.user?.id
  if (userId) {
    const todayString = now.toISOString().slice(0, 10)
    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select('type')
        .eq('user_id', userId)
        .eq('check_in_date', todayString)

      if (error) {
        console.error('Failed to load today\'s check-ins', error)
      } else {
        const entries = (data as { type: CheckInVariant }[] | null) ?? []
        const hasMorning = entries.some((entry) => entry.type === 'morning')
        const hasEvening = entries.some((entry) => entry.type === 'evening')

        variant = determineVariant({ timeOfDay, hasMorning, hasEvening })
      }
    } catch (error) {
      console.error('Unexpected error determining check-in variant', error)
    }
  }

  redirect(`/check-in/${variant}`)
}
