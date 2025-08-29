# Testing Personas System

The IFS app includes a persona switching system for testing different user types and their data in development mode.

## Quick Start

1. **Enable development mode** in your `.env.local`:
```bash
IFS_DEV_MODE=true
IFS_TEST_PERSONA=beginner  # optional: beginner|moderate|advanced
```

2. **Seed the personas** (one-time setup):
```bash
npm run seed:personas -- --confirm "seed personas"
```

3. **Start development** and use the persona switcher in the UI:
```bash
npm run dev
```

Look for the amber **"Alex Beginner"** button in the header when in dev mode.

## Three Test Personas

### 🟢 Alex Beginner (`beginner`)
- **UUID**: `11111111-1111-1111-1111-111111111111`
- **Email**: `alex.beginner@ifsdev.local`
- **Profile**: New to IFS (14 days), 3-5 sessions, discovering first parts
- **Use Case**: Testing initial user experience, basic insights, early part discovery

### 🔵 Jamie Moderate (`moderate`)  
- **UUID**: `22222222-2222-2222-2222-222222222222`
- **Email**: `jamie.moderate@ifsdev.local`
- **Profile**: Regular user (90 days), 10-14 sessions, active part relationships
- **Use Case**: Testing established user workflows, varied insights, relationship dynamics

### 🟣 Riley Advanced (`advanced`)
- **UUID**: `33333333-3333-3333-3333-333333333333`
- **Email**: `riley.advanced@ifsdev.local`  
- **Profile**: Power user (180+ days), 20+ sessions, complex part ecosystem
- **Use Case**: Testing advanced features, comprehensive insights, integration patterns

## How It Works

### Environment Variables
```bash
# Core development mode
IFS_DEV_MODE=true              # Enables persona system and dev features

# Persona selection (optional)
IFS_TEST_PERSONA=beginner      # Default persona: beginner|moderate|advanced

# Legacy fallback (still supported)
IFS_DEFAULT_USER_ID=uuid       # Direct user ID override
```

### API Behavior
When `IFS_DEV_MODE=true`, API routes automatically:
1. Check for real authentication first
2. Fall back to persona system (`getCurrentPersona()`)
3. Fall back to `IFS_DEFAULT_USER_ID` if set
4. Throw error if no user ID available

### UI Persona Switcher
- **Visibility**: Only shows when `IFS_DEV_MODE=true`
- **Location**: Header of main pages (look for test tube + user icons)
- **Persistence**: Choice saved to `localStorage` as `ifs-test-persona`
- **Switching**: Page refreshes automatically to load new persona data

### Data Isolation
Each persona has completely separate data:
- ✅ Independent parts, sessions, relationships
- ✅ Separate insights and assessments  
- ✅ Isolated agent actions and audit trails
- ✅ Different user statistics and progress

## Seeding Commands

### Basic Seeding
```bash
# Create/update the three persona users
npm run seed:personas -- --confirm "seed personas"
```

### Wipe & Re-seed
```bash  
# Delete all persona data and recreate fresh users
npm run seed:personas -- --wipe --confirm "seed personas"
```

### Safety Features
- ✅ Requires `IFS_DEV_MODE=true`
- ✅ Requires explicit `--confirm "seed personas"` flag
- ✅ Validates database schema before proceeding
- ✅ Uses admin client to bypass RLS safely
- ✅ Never affects production environments

## Development Workflow

### Testing Different User Types
```bash
# Test with a new user
IFS_TEST_PERSONA=beginner npm run dev

# Test with established user  
IFS_TEST_PERSONA=moderate npm run dev

# Test with power user
IFS_TEST_PERSONA=advanced npm run dev
```

### Using the UI Switcher
1. Start dev server: `npm run dev`
2. Look for amber persona indicator in header
3. Click to see dropdown with all personas
4. Select different persona → page refreshes with new data
5. Choice persists across browser sessions

### Adding Rich Data (Future)
The current seed script creates basic user profiles. Future enhancements will add:
- 📋 Realistic IFS conversation sessions
- 🎭 Parts with proper relationships and evolution
- 💡 Insights across all types and statuses
- 📊 Agent actions for rollback testing
- 📈 Statistical progression over time

## Troubleshooting

### Persona Switcher Not Showing
- ✅ Check `IFS_DEV_MODE=true` in environment
- ✅ Restart dev server after env changes
- ✅ Verify you're on a supported page (e.g., homepage)

### API Returns "Unauthorized"
- ✅ Ensure `IFS_DEV_MODE=true` 
- ✅ Run seeding: `npm run seed:personas -- --confirm "seed personas"`
- ✅ Check console for persona selection logs when `IFS_VERBOSE=true`

### Switching Doesn't Work
- ✅ Check browser localStorage for `ifs-test-persona` key
- ✅ Clear localStorage: `localStorage.removeItem('ifs-test-persona')`
- ✅ Verify page refreshes after selection (expected behavior)

### Database Issues
- ✅ Verify Supabase credentials in environment
- ✅ Check all migrations are applied
- ✅ Use `--wipe` flag to reset persona data clean

## Production Safety

The persona system is development-only:
- 🛡️ `PersonaSwitcher` only renders when `IFS_DEV_MODE=true`
- 🛡️ Seed scripts require dev mode environment variable
- 🛡️ Persona logic falls back to real auth in production
- 🛡️ No persona code runs when `NODE_ENV=production`

This ensures zero impact on production builds and user experience.
