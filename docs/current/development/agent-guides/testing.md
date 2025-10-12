# Testing Guide

## Test Types

### Unit Tests
- Test individual functions/components in isolation
- Fast and focused
- Located: `scripts/tests/unit/`, `__tests__/`, or co-located `.test.ts`

### Integration Tests
- Test multiple components working together
- Test API routes, database interactions
- Located: `scripts/tests/integration/`

### End-to-End Tests
- Test full user workflows
- Use Playwright
- Located: `e2e/`

## Running Tests

```bash
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e

# Run specific test file
npm test path/to/test.test.ts

# Run tests in watch mode
npm test -- --watch
```

## Writing Tests

### Unit Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { validateCheckIn } from '@/lib/check-ins/validation';

describe('validateCheckIn', () => {
  it('should reject empty responses', () => {
    const result = validateCheckIn({ response: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Response required');
  });

  it('should accept valid responses', () => {
    const result = validateCheckIn({ response: 'I feel good' });
    expect(result.success).toBe(true);
  });
});
```

### Integration Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { createClient } from '@/lib/supabase/server';

describe('Check-in API', () => {
  it('should create check-in', async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('check_ins')
      .insert({ response: 'Test response' })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.response).toBe('Test response');
  });
});
```

### E2E Test Example
```typescript
import { test, expect } from '@playwright/test';

test('user can complete check-in', async ({ page }) => {
  await page.goto('/check-in');
  
  await page.fill('[data-testid="check-in-input"]', 'I feel great today');
  await page.click('[data-testid="submit-button"]');
  
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

## Test Organization

### File Naming
- Unit tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.spec.ts` in `e2e/` directory

### Test Structure
```typescript
describe('Feature/Component Name', () => {
  // Setup
  beforeEach(() => {
    // Common setup
  });

  describe('specific functionality', () => {
    it('should do expected thing', () => {
      // Arrange
      const input = setupInput();
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

## Best Practices

### Do:
- ✅ Write tests for new features
- ✅ Add tests when fixing bugs
- ✅ Test edge cases (null, empty, large values)
- ✅ Use descriptive test names
- ✅ Keep tests focused and simple
- ✅ Mock external dependencies
- ✅ Test both success and error cases

### Don't:
- ❌ Test implementation details
- ❌ Write flaky tests
- ❌ Skip tests to make CI pass
- ❌ Test third-party code
- ❌ Make tests dependent on each other
- ❌ Use real API keys in tests

## Testing Checklist

Before opening PR:
- [ ] All new code has tests
- [ ] All tests pass locally
- [ ] Tests cover edge cases
- [ ] Tests are not flaky
- [ ] Test names are descriptive
- [ ] Mocks are used appropriately

## Common Testing Patterns

### Testing React Components
```typescript
import { render, screen } from '@testing-library/react';
import { CheckInButton } from '@/components/check-in/CheckInButton';

it('should render button', () => {
  render(<CheckInButton />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

### Testing API Routes
```typescript
import { POST } from '@/app/api/check-in/route';

it('should handle POST request', async () => {
  const request = new Request('http://localhost/api/check-in', {
    method: 'POST',
    body: JSON.stringify({ response: 'Test' }),
  });

  const response = await POST(request);
  expect(response.status).toBe(200);
});
```

### Testing Database Operations
```typescript
import { createClient } from '@/lib/supabase/server';

it('should query database', async () => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .limit(1);

  expect(error).toBeNull();
  expect(data).toBeDefined();
});
```

### Testing Agent Tools
```typescript
import { createAssessmentTools } from '@/mastra/tools/assessment-tools';

it('should create assessment', async () => {
  const tools = createAssessmentTools('user-id');
  const result = await tools.createAssessment({
    partId: 'part-123',
    type: 'initial',
  });

  expect(result.success).toBe(true);
});
```

## Debugging Tests

### Test Failing Locally
```bash
# Run single test
npm test path/to/test.test.ts

# Run with verbose output
npm test -- --verbose

# Run with debugger
node --inspect-brk node_modules/.bin/vitest path/to/test.test.ts
```

### Test Passing Locally but Failing in CI
- Check for environment differences
- Verify test isolation (no shared state)
- Check for timing issues (add waits if needed)
- Review CI logs for specific errors

## Test Coverage

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/index.html
```

Aim for:
- **80%+ coverage** for critical paths
- **100% coverage** for utility functions
- **Focus on behavior**, not just lines covered

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
