import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

import { stripe } from '@/lib/stripe'
import { toDateTime } from '@/lib/utils'
import {
  type Database,
  type ProductRow,
  type PriceRow,
  type SubscriptionRow,
} from '@/lib/types/database'

// Supabase admin client for server-side operations
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export const upsertProductRecord = async (product: Stripe.Product) => {
  const productData: ProductRow = {
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description ?? null,
    image: product.images?.[0] ?? null,
    metadata: product.metadata,
  }

  const { error } = await supabaseAdmin.from('products').upsert([productData])
  if (error) {
    throw new Error(`Failed to upsert product: ${error.message}`)
  }
  console.log(`Product upserted: ${product.id}`)
}

export const upsertPriceRecord = async (price: Stripe.Price) => {
  const priceData: PriceRow = {
    id: price.id,
    product_id: typeof price.product === 'string' ? price.product : '',
    active: price.active,
    currency: price.currency,
    description: price.nickname ?? null,
    type: price.type,
    unit_amount: price.unit_amount ?? null,
    interval: price.recurring?.interval ?? null,
    interval_count: price.recurring?.interval_count ?? null,
    trial_period_days: price.recurring?.trial_period_days ?? null,
    metadata: price.metadata,
  }

  const { error } = await supabaseAdmin.from('prices').upsert([priceData])
  if (error) {
    throw new Error(`Failed to upsert price: ${error.message}`)
  }
  console.log(`Price upserted: ${price.id}`)
}

export const createOrRetrieveCustomer = async ({
  email,
  uuid,
}: {
  email: string
  uuid: string
}) => {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('stripe_customer_id')
    .eq('id', uuid)
    .single()
  if (error || !data?.stripe_customer_id) {
    // No customer record found, let's create one in Stripe.
    const customerData: { metadata: { supabaseUUID: string }; email?: string } = {
      metadata: {
        supabaseUUID: uuid,
      },
    }
    if (email) customerData.email = email
    const customer = await stripe.customers.create(customerData)
    // Now insert the customer record into our database.
    const { error: supabaseError } = await supabaseAdmin
      .from('customers')
      .insert([{ id: uuid, stripe_customer_id: customer.id }])
    if (supabaseError) {
      throw new Error(`Failed to insert customer into Supabase: ${supabaseError.message}`)
    }
    console.log(`New customer created and inserted for ${uuid}.`)
    return customer.id
  }
  return data.stripe_customer_id
}

export const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string,
  createAction = false
) => {
  // Get customer's UUID from mapping table.
  const { data: customerData, error: noCustomerError } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (noCustomerError) {
    throw new Error(`Could not find customer in DB: ${noCustomerError.message}`)
  }

  const { id: uuid } = customerData

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method'],
  })

  // Upsert the latest status of the subscription object.
  const subscriptionData: SubscriptionRow = {
    id: subscription.id,
    user_id: uuid,
    metadata: subscription.metadata,
    status: subscription.status,
    price_id: subscription.items.data[0].price.id,
    quantity: subscription.items.data[0].quantity,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: subscription.cancel_at ? toDateTime(subscription.cancel_at).toISOString() : null,
    canceled_at: subscription.canceled_at
      ? toDateTime(subscription.canceled_at).toISOString()
      : null,
    current_period_start: toDateTime(subscription.current_period_start).toISOString(),
    current_period_end: toDateTime(subscription.current_period_end).toISOString(),
    ended_at: subscription.ended_at ? toDateTime(subscription.ended_at).toISOString() : null,
    trial_start: subscription.trial_start
      ? toDateTime(subscription.trial_start).toISOString()
      : null,
    trial_end: subscription.trial_end ? toDateTime(subscription.trial_end).toISOString() : null,
    created: toDateTime(subscription.created).toISOString(),
  }

  const { error } = await supabaseAdmin.from('subscriptions').upsert([subscriptionData])
  if (error) {
    throw new Error(`Failed to upsert subscription: ${error.message}`)
  }
  console.log(`Subscription upserted for ${uuid}: ${subscription.id}`)
}
