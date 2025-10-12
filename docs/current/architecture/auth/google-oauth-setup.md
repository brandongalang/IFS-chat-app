# Google OAuth Authentication Setup

This document covers the complete setup and troubleshooting guide for Google OAuth authentication in the IFS application.

## Overview

Our Google authentication uses:
- **Google Identity Services (GIS)** for client-side sign-in buttons
- **Supabase Auth** for server-side token verification and user management
- **Custom nonce handling** for enhanced security (raw/hashed nonce pattern)
- **Supabase session synchronization** to keep server cookies aligned with client auth state

## Required Configuration

### 1. Google Cloud Console Setup

**Create OAuth 2.0 Client ID:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Create **OAuth 2.0 Client ID** (type: Web application)

**Configure Origins and Redirects:**
- **Authorized JavaScript origins:**
  - Production: `https://your-production-domain.com`
  - Local: `http://localhost:3000`
- **Authorized redirect URIs:**
  - Production: `https://your-supabase-ref.supabase.co/auth/v1/callback`
  - Local: `http://localhost:54321/auth/v1/callback`

**OAuth Consent Screen:**
- Configure and publish the consent screen
- Add your domain to authorized domains

### 2. Environment Variables

**Production Environment:**
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id-here
BASE_URL=https://your-production-domain.com
SUPABASE_SERVICE_ROLE_KEY=service-role-key
CRON_SECRET=shared-secret-if-used
```

**Local Environment (.env.local):**
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id-here
BASE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=service-role-key
```

### 3. Supabase Provider Configuration

**Production Supabase Dashboard:**
1. Go to **Authentication** → **Providers** → **Google**
2. Set **Enabled** = On
3. **Client ID**: Must match `NEXT_PUBLIC_GOOGLE_CLIENT_ID` exactly
4. **Client Secret**: From your Google Cloud Console OAuth client
5. **Redirect URL**: `https://your-supabase-ref.supabase.co/auth/v1/callback`
6. **Skip nonce check**: Keep **false** (recommended for security)
 7. **Refresh token rotation**: Keep **enabled** (required for session sync)

**Local Supabase (supabase/config.toml):**
```toml
[auth.external.google]
enabled = true
client_id = "your-google-client-id"
secret = "your-google-client-secret"
redirect_uri = "http://localhost:54321/auth/v1/callback"
skip_nonce_check = false
enable_refresh_token_rotation = true
additional_redirect_urls = ["https://127.0.0.1:3000"]
```

## How It Works

### Nonce Security Pattern

Our implementation uses a dual-nonce pattern for enhanced security:

1. **Generate**: Create a random 32-byte value (raw nonce)
2. **Hash**: SHA-256 hash the raw nonce (hashed nonce)
3. **Send to GIS**: Use hashed nonce in Google Identity Services initialization
4. **Send to Supabase**: Use raw nonce when calling `signInWithIdToken`

```typescript
// Nonce generation (simplified)
const raw = generateRandomBytes(32)
const hashed = sha256(raw)

// GIS initialization
google.accounts.id.initialize({
  client_id: clientId,
  nonce: hashed,  // Hashed nonce
  callback: (response) => {
    supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.credential,
      nonce: raw,  // Raw nonce
    })
  }
})
```

### Button Implementation

We use only **Google Identity Services** rendered buttons:

```jsx
// Container for GIS button
<div id="google-btn-container" />

// Initialize button
useEffect(() => {
  initGoogleButton('google-btn-container', '/')
}, [])
```

## Troubleshooting

### Session sync failures (POST /auth/callback)

**Symptoms:** `/auth/callback` POST returns 4xx/5xx, cookies fail to update, or repeated console retries.

**Checklist:**
1. Confirm `BASE_URL`/`APP_BASE_URL`/`NEXT_PUBLIC_APP_URL` match the domain making the request (origin allowlist lives in `app/auth/callback/route.ts`).
2. Ensure refresh tokens are issued: in Supabase Auth settings enable refresh rotation and confirm the response payload includes `refresh_token`.
3. Check server logs for `Auth callback session user mismatch` or `missing refresh token` and resolve underlying Supabase config.
4. Verify `SUPABASE_SERVICE_ROLE_KEY` is present in the server environment; it is required for `setSession` calls.

### Nonce Mismatch Error

**Root Cause**: Client ID mismatch between frontend and Supabase.

**Solution:**
1. Verify `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in your hosting environment
2. Ensure Supabase provider Client ID matches exactly
3. Check that both use the same Google Cloud OAuth client

**Debug Steps:**
1. Check browser network tab for the actual client ID being used
2. Decode the ID token at [jwt.io](https://jwt.io) and verify the `aud` claim
3. Check Supabase Auth logs for specific error details

### Button Not Rendering

**Common Causes:**
- Missing container element
- Container not in DOM when `initGoogleButton` is called
- Google Identity Services script failed to load

**Solutions:**
- Ensure container exists: `<div id="google-btn-container" />`
- Call `initGoogleButton` in `useEffect` after component mount
- Check browser console for script loading errors

### Double Initialization

**Symptoms**: Multiple buttons or "nonce already used" errors

**Causes:**
- Multiple components calling `initGoogleButton` with same container ID
- Component re-mounting without proper cleanup

**Solutions:**
- Use unique container IDs for different forms
- Implement proper cleanup in `useEffect`
- Extract shared Google button component if needed

### Local Development Issues

**Missing Environment Variables:**
- Add Google Client ID to `.env.local`
- Configure Supabase local instance with Google provider settings
- Set `BASE_URL=http://localhost:3000` so the callback accepts the origin

**HTTPS Requirements:**
- Some Google features require HTTPS
- Use `localhost` instead of `127.0.0.1` for better compatibility

### Disallowed origin (403)

**Root Cause:** The callback computes an allowlist from the current request, configured base URL, and Vercel preview URL. If your origin is missing, the request is rejected.

**Solution:** Update `BASE_URL`, `APP_BASE_URL`, or `NEXT_PUBLIC_APP_URL` in the environment to the exact origin (protocol + host + port). For preview deployments, surface the generated URL via env vars or add to `additional_redirect_urls` in `supabase/config.toml`.

### Missing refresh token (400)

**Root Cause:** Supabase is not issuing refresh tokens (rotation disabled) or the POST body omitted the token.

**Solution:** Re-enable refresh rotation in Supabase, ensure the browser payload includes `session.refresh_token`, and inspect network traces for redaction issues.

## Testing Checklist

### Production Deployment
- [ ] Environment variable `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set
- [ ] Supabase provider Client ID matches environment variable
- [ ] Google Cloud Console has correct origins and redirect URIs
- [ ] OAuth consent screen is published
- [ ] Supabase Auth settings have refresh rotation enabled
- [ ] Test sign-in flow in incognito window and observe `/auth/callback` POST succeeds

### Local Development
- [ ] `.env.local` has Google Client ID
- [ ] `supabase/config.toml` has Google provider configured
- [ ] Local Supabase is running with `supabase start`
- [ ] Test both login and sign-up forms and confirm cookies refresh after sign-in/out

### UI/UX Verification
- [ ] Only one Google button appears on login page
- [ ] Only one Google button appears on sign-up page
- [ ] Buttons render with proper Google styling
- [ ] Error messages are clear and helpful
- [ ] Successful sign-in redirects correctly and retains session on full refresh

## Common Patterns

### Adding Google Button to New Form

```jsx
import { useGoogleAuth } from '@/lib/hooks/use-google-auth'

export function MyForm() {
  const { initGoogleButton, error: googleError } = useGoogleAuth()
  
  useEffect(() => {
    initGoogleButton('my-google-btn-container', '/redirect-path')
  }, [])
  
  return (
    <div>
      {/* Your form */}
      <div id="my-google-btn-container" />
      {googleError && <p className="error">{googleError}</p>}
    </div>
  )
}
```

### Shared Google Button Component

```jsx
export function GoogleAuthButton({ containerId, redirectPath }) {
  const { initGoogleButton, error } = useGoogleAuth()
  
  useEffect(() => {
    initGoogleButton(containerId, redirectPath)
  }, [containerId, redirectPath])
  
  return (
    <div>
      <div id={containerId} />
      {error && <p className="error">{error}</p>}
    </div>
  )
}
```

## Security Considerations

- Never commit Google Client Secret to version control
- Use environment variable substitution in Supabase config
- Keep `skip_nonce_check = false` for production (enhanced security)
- Validate redirect URIs match your actual domains
- Monitor Supabase Auth logs for suspicious activity

## Support and Resources

- [Google Identity Services Documentation](https://developers.google.com/identity/gsi/web)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
