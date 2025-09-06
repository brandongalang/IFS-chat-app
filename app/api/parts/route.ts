import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: parts, error } = await supabase
      .from('parts')
      .select('id, name, visualization')
      .eq('user_id', user.id)
      .order('last_active', { ascending: false })

    if (error) {
      console.error('Error fetching parts:', error)
      return NextResponse.json({ error: 'Failed to fetch parts' }, { status: 500 })
    }

    return NextResponse.json(parts, { status: 200 })
  } catch (error) {
    console.error('Parts API error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
