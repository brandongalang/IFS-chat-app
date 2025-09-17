# Google OAuth Authentication Setup

This document covers the complete setup and troubleshooting guide for Google OAuth authentication in the IFS application.

## Overview

Our Google authentication uses:
- **Google Identity Services (GIS)** for client-side sign-in buttons
- **Supabase Auth** for server-side token verification and user management
- **Custom nonce handling** for enhanced security (raw/hashed nonce pattern)

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
```

**Local Environment (.env.local):**
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id-here
```

### 3. Supabase Provider Configuration

**Production Supabase Dashboard:**
1. Go to **Authentication** → **Providers** → **Google**
2. Set **Enabled** = On
3. **Client ID**: Must match `NEXT_PUBLIC_GOOGLE_CLIENT_ID` exactly
4. **Client Secret**: From your Google Cloud Console OAuth client
5. **Redirect URL**: `https://your-supabase-ref.supabase.co/auth/v1/callback`
6. **Skip nonce check**: Keep **false** (recommended for security)

**Local Supabase (supabase/config.toml):**
```toml
[auth.external.google]
enabled = true
client_id = "your-google-client-id"
secret = "your-google-client-secret"
redirect_uri = "http://localhost:54321/auth/v1/callback"
skip_nonce_check = false
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

**HTTPS Requirements:**
- Some Google features require HTTPS
- Use `localhost` instead of `127.0.0.1` for better compatibility

## Testing Checklist

### Production Deployment
- [ ] Environment variable `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set
- [ ] Supabase provider Client ID matches environment variable
- [ ] Google Cloud Console has correct origins and redirect URIs
- [ ] OAuth consent screen is published
- [ ] Test sign-in flow in incognito window

### Local Development
- [ ] `.env.local` has Google Client ID
- [ ] `supabase/config.toml` has Google provider configured
- [ ] Local Supabase is running with `supabase start`
- [ ] Test both login and sign-up forms

### UI/UX Verification
- [ ] Only one Google button appears on login page
- [ ] Only one Google button appears on sign-up page
- [ ] Buttons render with proper Google styling
- [ ] Error messages are clear and helpful
- [ ] Successful sign-in redirects correctly

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