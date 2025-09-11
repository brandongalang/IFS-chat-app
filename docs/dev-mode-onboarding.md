# Dev Mode Onboarding Playground

## Purpose

The onboarding dev playground provides a streamlined way to UAT test the onboarding flow without the authentication hassles typical in development environments. This tool is designed for developers and QA engineers to:

- Test onboarding scoring algorithms with different answer combinations
- Validate Stage 2 question selection logic 
- Debug onboarding flow issues without creating test users
- Verify scoring edge cases and validation rules
- Compare fixture vs. live database behavior

## Access

### Route
- **URL**: `/dev/onboarding`
- **Access Control**: Only available when `NEXT_PUBLIC_IFS_DEV_MODE=true`
- **Environment**: Development only (blocked in production)

### Quick Start Scripts

```bash
# Start dev server with onboarding playground enabled
npm run dev:onboarding

# Run unit tests for onboarding algorithms  
npm run test:unit:onboarding

# Run E2E tests for the playground
npm run e2e:dev:onboarding
```

## Features

### 🎯 Stage 1 Testing
- **Answer Presets**: Pre-configured answer combinations for common scenarios:
  - `Perfectionism & Anxiety`: High scores in perfectionism, anxiety, self-criticism
  - `Relational & Caretaking`: Focus on relationships and caring for others
  - `Control & Safety`: High need for control and safety
- **Score Computation**: Real-time calculation using `computeStage1Scores()`
- **Validation**: Automatic checks for score ranges [0,1] and expected theme activation
- **Visual Display**: Score cards with progress bars and raw JSON inspection

### 🎯 Stage 2 Testing  
- **Selection Algorithm**: Uses `selectStage2Questions()` with Stage 1 scores as input
- **Validation**: Runs `validateStage2Selection()` to ensure selection quality
- **Results Display**: Shows selected question IDs, top themes, and coverage metrics
- **Question Preview**: Full question text and options for selected questions

### 🔄 Data Source Toggle
- **Fixture Mode** (Default): Uses local test data from `lib/dev/fixtures.ts`
- **Live Mode**: Fetches questions from database via API endpoints
- **Fallback Behavior**: Gracefully falls back to fixtures if live data unavailable
- **Status Indicators**: Clear badges showing data source status

### 🛡️ Safety Features
- **Dev Mode Guard**: Completely inaccessible when dev flags are disabled
- **Warning Banners**: Clear indicators that this is a development tool
- **Environment Checks**: Multiple layers of dev-only protection
- **Reset Functionality**: Quick reset of all test data

## Configuration

### Environment Variables

```bash
# Required for access
NEXT_PUBLIC_IFS_DEV_MODE=true

# Optional: for live database testing
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### Fixture vs Live Data

| Mode | Data Source | Use Case |
|------|-------------|----------|
| **Fixture** | `lib/dev/fixtures.ts` | Consistent, predictable testing |
| **Live** | Database via API | Integration testing, real data validation |

## Testing Workflow

### 1. Basic Validation
1. Navigate to `/dev/onboarding` 
2. Select "Perfectionism & Anxiety" preset (default)
3. Click "Compute Stage 1 Scores"
4. Verify scores show green checkmark validation
5. Click "Run Stage 2 Selection" 
6. Switch to "Stage 2 Results" tab
7. Verify 4 unique question IDs and valid coverage score

### 2. Preset Comparison
1. Test each preset and compare score patterns
2. Verify different presets activate expected themes
3. Check that Stage 2 selection adapts to different Stage 1 scores

### 3. Live Data Testing
1. Toggle "Use Live Database" ON
2. Verify question count badge appears
3. Run through scoring with live data
4. Compare results with fixture mode

### 4. Edge Case Testing
1. Create custom answer combinations
2. Test boundary conditions (all zeros, all maximum scores)
3. Verify validation catches invalid states

## Troubleshooting

### Common Issues

**❌ "Access Denied" error**
- Solution: Ensure `NEXT_PUBLIC_IFS_DEV_MODE=true` in environment

**❌ "No live data" badge**  
- Solution: Check database connection and API endpoints
- Fallback: Toggle to fixture mode for testing

**❌ Scores outside [0,1] range**
- Solution: Check scoring algorithm implementation
- Check: Verify answer values match expected constants

**❌ Stage 2 validation fails**
- Solution: Ensure question bank has minimum 4 questions
- Check: Verify theme weights are properly configured

**❌ TypeScript errors**
- Solution: Ensure fixture data matches `OnboardingQuestion` schema
- Check: Verify answer responses use correct `QuestionResponse` format

### Debug Tools

**Console Logging**: All errors logged to browser console with detailed context

**Raw JSON View**: Expandable details sections show full data structures

**Network Tab**: Monitor API calls when using live data mode

**React DevTools**: Inspect component state and props

## Development Guidelines

### Fixture Updates
- Update `lib/dev/fixtures.ts` when modifying question structure
- Keep fixtures aligned with unit tests to prevent drift
- Test both fixture and live modes when making changes

### Adding New Presets
```typescript
// Add to ANSWER_PRESETS in lib/dev/fixtures.ts
'new_preset': {
  name: 'Preset Name',
  description: 'Brief description of what this tests',
  answers: {
    S1_Q1: { type: 'single_choice', value: 'answer_value' },
    // ... more answers
  },
}
```

### UI Component Guidelines
- Use existing shadcn/ui components for consistency
- Include loading states and error boundaries
- Add proper ARIA labels for accessibility
- Follow existing color scheme (green=valid, red=invalid)

## Security Considerations

### Production Safety
- **Environment Guards**: Multiple checks prevent production access
- **Build Exclusion**: Route tree-shaken out in production builds  
- **No Secrets**: No API keys or sensitive data in fixtures
- **Local Only**: No external API calls in fixture mode

### Data Privacy
- **Test Data Only**: Fixtures contain no real user information
- **Session Isolation**: No persistent storage of test sessions
- **Clean State**: Reset functionality clears all test data

## Integration with Testing

### Unit Tests
- Fixtures shared between dev playground and unit tests
- Prevents test data drift and maintenance overhead
- Located in `scripts/tests/unit/`

### E2E Tests  
- Playwright tests target `/dev/onboarding` route
- Automated validation of core workflows
- Screenshot and trace capture on failures
- Run via `npm run e2e:dev:onboarding`

### CI/CD Integration
- Dev mode tests run in CI with appropriate environment flags
- Validates that dev tools don't break production builds
- Ensures dev dependencies stay development-only

---

## Quick Reference

| Action | Command/URL |
|--------|-------------|
| **Start Playground** | `npm run dev:onboarding` → `http://localhost:3000/dev/onboarding` |
| **Run Tests** | `npm run test:unit:onboarding` |
| **E2E Tests** | `npm run e2e:dev:onboarding` |
| **Reset Data** | Click "Reset All" button |
| **Toggle Data Source** | Click "Use Live Database" switch |
| **View Raw JSON** | Click "View Raw JSON" or "View Selection Details" |

For additional support, see the main project README or consult the onboarding implementation in `lib/onboarding/`.
