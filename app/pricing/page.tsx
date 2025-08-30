import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import CheckoutButton from '@/components/pricing/checkout-button'

export default async function PricingPage() {
  const supabase = createClient()

  const { data: products, error } = await supabase
    .from('products')
    .select('*, prices(*)')
    .eq('active', true)
    .eq('prices.active', true)
    .order('metadata->index')

  if (error) {
    console.error('Error fetching products:', error)
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-3xl font-bold mb-6">Pricing</h1>
        <p className="text-red-500">Could not load pricing plans. Please try again later.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Choose Your Plan
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
            Start for free, then upgrade to unlock your full potential.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Free Plan Card (Static) */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription>For getting started and basic exploration.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-4xl font-extrabold">
                $0<span className="text-lg font-medium text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-6 space-y-4">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span>15 messages per day</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span>2 visible parts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span>Standard AI Model</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button disabled className="w-full">
                Your Current Plan
              </Button>
            </CardFooter>
          </Card>

          {/* Paid Plan Cards (Dynamic) */}
          {products?.map((product) => {
            const monthlyPrice = product.prices.find((p) => p.interval === 'month')
            // TODO: Add yearly price logic if exists

            if (!monthlyPrice) return null

            return (
              <Card key={product.id} className="flex flex-col border-primary">
                <CardHeader>
                  <CardTitle>{product.name}</CardTitle>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-4xl font-extrabold">
                    ${(monthlyPrice.unit_amount || 0) / 100}
                    <span className="text-lg font-medium text-muted-foreground">/mo</span>
                  </p>
                  <ul className="mt-6 space-y-4">
                     <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Unlimited messages</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Unlimited parts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Premium AI Model</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <CheckoutButton price={monthlyPrice} />
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
