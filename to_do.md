# TODO: Resuming Local Development & Deployment

This document outlines the remaining tasks to test the new subscription features locally and deploy the application to production.

## 1. Local Stripe Testing

To test the full subscription flow locally, you need to use the Stripe CLI to forward webhook events to your local development server.

### Steps:

1.  **Install the Stripe CLI:** Follow the instructions [here](https://stripe.com/docs/stripe-cli#install).

2.  **Log in to the CLI:**
    ```bash
    stripe login
    ```

3.  **Start the local development server:**
    ```bash
    npm run dev
    ```

4.  **Forward webhooks:** In a **separate terminal**, run the following command. This will connect to your Stripe account and give you a webhook secret (`whsec_...`).
    ```bash
    stripe listen --forward-to localhost:3000/api/stripe/webhook
    ```

5.  **Set up your `.env.local` file:**
    *   Copy the `whsec_...` secret from the previous step and set it as `STRIPE_WEBHOOK_SECRET`.
    *   Add your Stripe test mode API keys for `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY`.
    *   Ensure all other environment variables from `.env.example` are set.

6.  **Create Products in Stripe:**
    *   The application syncs product and price data from Stripe. You need to create at least one Product with a recurring Price in your Stripe Test Mode Dashboard.
    *   Go to the [Stripe Products Dashboard](https://dashboard.stripe.com/test/products) to create them.

7.  **Test the flow:**
    *   With both the dev server and the Stripe CLI running, you can now test the full user journey:
        *   Sign up for a new account.
        *   Go to the `/pricing` page.
        *   Click "Upgrade" and complete the Stripe Checkout flow using a test card.
        *   The webhook should fire, and your local server will process it, granting the user a "paid" subscription. You can verify this by checking the `subscriptions` table in your local Supabase instance.

## 2. Frontend Verification (Optional but Recommended)

You can visually verify the new pages using Playwright.

1.  **Install Playwright:**
    ```bash
    pip install playwright
    playwright install
    ```

2.  **Create and run a verification script** (e.g., `verify.py`):
    ```python
    from playwright.sync_api import sync_playwright

    def run(playwright):
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:3000/pricing")
        page.screenshot(path="pricing_page.png")
        page.goto("http://localhost:3000/settings")
        page.screenshot(path="settings_page.png")
        browser.close()

    with sync_playwright() as playwright:
        run(playwright)
    ```
    Run it with `python verify.py`. This will save screenshots of the new pages for you to review.

## 3. Production Deployment

1.  **Set up Production Environment Variables:**
    *   In your hosting provider (e.g., Vercel), set all the environment variables listed in `.env.example`.
    *   Make sure to use your **LIVE** Stripe API keys, not the test keys.
    *   Set `NEXT_PUBLIC_SITE_URL` to your final production domain.

2.  **Set up Production Stripe Webhook:**
    *   In your Stripe Live Mode dashboard, create a new webhook endpoint.
    *   The URL should be `https://<your-site-url>/api/stripe/webhook`.
    *   Get the new webhook secret and set it as `STRIPE_WEBHOOK_SECRET` in your production environment variables.

3.  **Deploy:**
    *   Push your code to your Git provider and deploy it via your hosting platform.
