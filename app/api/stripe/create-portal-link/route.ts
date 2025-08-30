import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { getURL } from '@/lib/utils'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!customer || !customer.stripe_customer_id) {
      return new Response('Stripe customer not found.', { status: 404 })
    }

    const { url } = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${getURL()}/profile`, // Or settings page
    })

    return NextResponse.json({ url })
  } catch (err: any) {
    console.log(err)
    return new Response(err.message, { status: 500 })
  }
}
