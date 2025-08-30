'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getStripe } from '@/lib/stripe/client'
import { PriceRow } from '@/lib/types/database'

interface CheckoutButtonProps {
  price: PriceRow
}

export default function CheckoutButton({ price }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price,
          quantity: 1,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { sessionId } = await res.json()
      const stripe = await getStripe()
      if (!stripe) {
        throw new Error('Stripe.js not loaded')
      }
      const { error } = await stripe.redirectToCheckout({ sessionId })

      if (error) {
        console.error(error)
      }
    } catch (error) {
      console.error(error)
      // TODO: Show a toast notification to the user
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleCheckout} disabled={loading} className="w-full">
      {loading ? 'Loading...' : 'Upgrade'}
    </Button>
  )
}
