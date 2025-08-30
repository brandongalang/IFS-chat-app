import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { createOrRetrieveCustomer } from '@/lib/supabase/admin'
import { getURL } from '@/lib/utils'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { price, quantity = 1, metadata = {} } = await req.json()

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const customer = await createOrRetrieveCustomer({
      uuid: user.id || '',
      email: user.email || '',
    })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      customer,
      line_items: [
        {
          price: price.id,
          quantity,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      subscription_data: {
        metadata,
      },
      success_url: `${getURL()}/`,
      cancel_url: `${getURL()}/pricing`,
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (err: any) {
    console.log(err)
    return new Response(err.message, { status: 500 })
  }
}
