-- This migration is based on the Vercel saas-starter template.
-- It sets up the necessary tables to sync Stripe data with the application database.

-- Create a type for subscription status
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused');

-- Customers table
CREATE TABLE customers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) NOT NULL,
  stripe_customer_id text UNIQUE
);
COMMENT ON TABLE customers IS 'Links user profiles to Stripe customer IDs.';

-- Products table
CREATE TABLE products (
  id text PRIMARY KEY,
  active boolean,
  name text,
  description text,
  image text,
  metadata jsonb
);
COMMENT ON TABLE products IS 'Stores product information from Stripe.';

-- Prices table
CREATE TABLE prices (
  id text PRIMARY KEY,
  product_id text REFERENCES products(id),
  active boolean,
  description text,
  unit_amount bigint,
  currency text,
  type text,
  "interval" text,
  interval_count integer,
  trial_period_days integer,
  metadata jsonb
);
COMMENT ON TABLE prices IS 'Stores price information for products from Stripe.';

-- Subscriptions table
CREATE TABLE subscriptions (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  status subscription_status,
  metadata jsonb,
  price_id text REFERENCES prices(id),
  quantity integer,
  cancel_at_period_end boolean,
  created timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  current_period_start timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  current_period_end timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  ended_at timestamptz DEFAULT timezone('utc'::text, now()),
  cancel_at timestamptz DEFAULT timezone('utc'::text, now()),
  canceled_at timestamptz DEFAULT timezone('utc'::text, now()),
  trial_start timestamptz DEFAULT timezone('utc'::text, now()),
  trial_end timestamptz DEFAULT timezone('utc'::text, now())
);
COMMENT ON TABLE subscriptions IS 'Stores user subscription information from Stripe.';

-- Enable RLS for the new tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Customers: Users can only see their own customer record.
CREATE POLICY "Allow individual read access" ON customers FOR SELECT USING (auth.uid() = id);

-- Products: All authenticated users can read product information.
CREATE POLICY "Allow read access to all users" ON products FOR SELECT USING (auth.role() = 'authenticated');

-- Prices: All authenticated users can read price information.
CREATE POLICY "Allow read access to all users" ON prices FOR SELECT USING (auth.role() = 'authenticated');

-- Subscriptions: Users can only see their own subscriptions.
CREATE POLICY "Allow individual read access" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
