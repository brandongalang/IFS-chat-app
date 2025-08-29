# Development Configuration Guide

This guide explains how to configure the IFS Therapy application for development and testing without full user authentication.

## Quick Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Set the required development environment variables in `.env.local`:
   ```bash
   # Enable development mode for local iteration (client + server)
   NEXT_PUBLIC_IFS_DEV_MODE=true
   
   # Generate a test UUID (you can use https://www.uuidgenerator.net/)
   IFS_DEFAULT_USER_ID=12345678-1234-5678-9012-123456789abc
   
   # Enable verbose logging for debugging
   IFS_VERBOSE=true
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

### Required for Development Mode

- `NEXT_PUBLIC_IFS_DEV_MODE=true` - Enables development mode features across SSR and CSR
- `IFS_DEFAULT_USER_ID` - UUID to use as default user ID when none provided

### Optional Development Variables

- `NEXT_PUBLIC_IFS_SHOW_DEV_TOGGLE=true` - Shows an in-app "Enable Dev Mode" control on the home header (hidden by default in production). Clicking it sets a localStorage override used on the client.
- `IFS_VERBOSE=true` - Enables detailed logging of tool operations
- `IFS_DISABLE_POLARIZATION_UPDATE=true` - Disables updating `polarization_level` during relationship updates (workaround for tsx/ESM dev runtime quirk). In production/serverless builds, leave unset or false so polarization updates apply normally.

### Production Supabase Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Agent API Keys

- `OPENROUTER_API_KEY` - For the IFS agent (required)

## How It Works

### Default User ID Resolution

When development mode is enabled with `NEXT_PUBLIC_IFS_DEV_MODE=true` (or `NODE_ENV=development`) and `IFS_DEFAULT_USER_ID` is set:

1. **With explicit userId**: Tools use the provided userId normally
2. **Without userId**: Tools automatically use `IFS_DEFAULT_USER_ID`
3. **No development config**: Tools throw an error requiring explicit userId

### User Confirmation Through Chat

User confirmation always happens through the chat interface:

- Agent asks "Would you like me to create this part?" 
- User responds "Yes" or "No" in chat
- Agent sets `userConfirmed: true` based on user's response
- Evidence requirements (3+ pieces) are still enforced

### Development Logging

When `IFS_VERBOSE=true`:

- All tool executions are logged with parameters
- Default user ID usage is logged
- Helpful for debugging agent interactions

## Testing Agent Tools

With development mode enabled, you can test agent tools without authentication:

```javascript
// This will work in development mode without passing userId
await searchParts({ query: "anxious" })

// This will also work - but requires user confirmation from chat
await createEmergingPart({
  name: "Anxious Achiever",
  evidence: [
    { type: "direct_mention", content: "I feel anxious about deadlines", confidence: 0.9, sessionId: "...", timestamp: "..." },
    { type: "pattern", content: "Always checking work multiple times", confidence: 0.8, sessionId: "...", timestamp: "..." },
    { type: "behavior", content: "Stays late to perfect presentations", confidence: 0.85, sessionId: "...", timestamp: "..." }
  ],
  userConfirmed: true  // Set this based on user's chat response
  // userId not required in development mode
})
```

## Production vs Development

| Feature | Production | Development Mode |
|---------|------------|------------------|
| User ID | Required from auth | Can use default |
| User Confirmation | Always required via chat | Always required via chat |
| Tool Logging | Minimal | Verbose available |
| Error Handling | Strict | More permissive |

## Security Notes

⚠️ **Important**: Development mode should only be used in local development environments.

- Never set `NEXT_PUBLIC_IFS_DEV_MODE=true` in production unless you want dev-gated areas enabled for users
- Never commit real user IDs to version control
- Use randomly generated UUIDs for `IFS_DEFAULT_USER_ID`
- Development mode is automatically disabled when `NODE_ENV=production` (unless explicitly enabled via `NEXT_PUBLIC_IFS_DEV_MODE`)

## Troubleshooting

### "User ID is required" Error

- Ensure `NEXT_PUBLIC_IFS_DEV_MODE=true` is set locally or `NODE_ENV=development`
- Ensure `IFS_DEFAULT_USER_ID` contains a valid UUID
- Check that environment variables are loaded (restart dev server)

### Agent Tools Not Working

- Verify `OPENROUTER_API_KEY` is set
- Check console for `[IFS-DEV]` log messages
- Ensure Supabase connection is working

### Database Connection Issues

- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check that the default user ID exists in your parts table (or create test data)
- Ensure database tables are properly migrated

## Creating Test Data

To create test data for your default user ID:

1. Use the Supabase dashboard to insert a test user record
2. Use the `createEmergingPart` tool with development mode to create test parts
3. Use database seeders if available

## Migration note

We consolidated dev mode to a single public flag:
- Remove any usage of `IFS_DEV_MODE` (server-only).
- Use `NEXT_PUBLIC_IFS_DEV_MODE` instead (works across SSR/CSR), with `NODE_ENV=development` as a default.

This configuration allows you to test the full agent workflow without implementing user authentication first.
