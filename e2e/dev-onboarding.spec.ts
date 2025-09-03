import { test, expect } from '@playwright/test';

test.describe('Dev Onboarding Playground', () => {
  test.beforeEach(async ({ page }) => {
    // Set dev mode environment and navigate to dev onboarding page
    await page.goto('/dev/onboarding');
  });

  test('should display dev onboarding playground', async ({ page }) => {
    // Check if the page loads properly
    await expect(page.locator('h1')).toContainText('Onboarding Dev Playground');
    
    // Check for dev mode warning
    await expect(page.locator('[role="alert"]')).toContainText('Development Mode Only');
    
    // Check for main controls
    await expect(page.locator('text=Test Controls')).toBeVisible();
    await expect(page.locator('text=Answer Preset')).toBeVisible();
  });

  test('should compute Stage 1 scores with perfectionism preset', async ({ page }) => {
    // Select the perfectionism preset (should be default)
    await expect(page.locator('[data-value="perfectionism_anxiety"]')).toBeVisible();
    
    // Click compute scores button
    await page.click('button:text("Compute Stage 1 Scores")');
    
    // Check that scores appear
    await expect(page.locator('text=Stage 1 Scores')).toBeVisible();
    
    // Check for expected themes being activated
    const perfectionismScore = page.locator('[data-theme="perfectionism"] .text-2xl');
    const anxietyScore = page.locator('[data-theme="anxiety"] .text-2xl');
    
    // Verify scores are displayed and are > 0 for expected themes
    await expect(page.locator('text=perfectionism')).toBeVisible();
    await expect(page.locator('text=anxiety')).toBeVisible();
    
    // Check validation - should show green checkmark
    await expect(page.locator('svg.text-green-500')).toBeVisible();
  });

  test('should run Stage 2 selection and validation', async ({ page }) => {
    // First compute Stage 1 scores
    await page.click('button:text("Compute Stage 1 Scores")');
    await expect(page.locator('text=Stage 1 Scores')).toBeVisible();
    
    // Then run Stage 2 selection
    await page.click('button:text("Run Stage 2 Selection")');
    
    // Switch to Stage 2 tab
    await page.click('[data-value="stage2"]');
    
    // Check Stage 2 results appear
    await expect(page.locator('text=Stage 2 Selection')).toBeVisible();
    await expect(page.locator('text=Selected Question IDs')).toBeVisible();
    await expect(page.locator('text=Top Themes')).toBeVisible();
    
    // Check validation results
    await expect(page.locator('text=Validation')).toBeVisible();
    await expect(page.locator('text=Valid:')).toBeVisible();
    await expect(page.locator('text=Coverage Score:')).toBeVisible();
    
    // Check that we get exactly 4 question IDs
    const questionBadges = page.locator('[data-testid="question-ids"] .badge, .badge:text-matches("S2_Q\\\\d+")');
    await expect(questionBadges).toHaveCount(4);
    
    // Check questions preview appears
    await expect(page.locator('text=Selected Questions Preview')).toBeVisible();
    
    // Should show validation as valid (green checkmark)
    await expect(page.locator('svg.text-green-500')).toBeVisible();
  });

  test('should toggle between fixture and live data modes', async ({ page }) => {
    // Check initial state (fixture mode)
    await expect(page.locator('text=Use Live Database (OFF)')).toBeVisible();
    
    // Toggle to live data mode
    await page.click('#live-data');
    
    // Should show live mode indicator
    await expect(page.locator('text=Use Live Database (ON)')).toBeVisible();
    
    // Should show badge indicating live data status
    const liveBadge = page.locator('.badge:text-matches("\\\\d+ questions loaded|No live data")');
    await expect(liveBadge).toBeVisible();
    
    // Toggle back to fixture mode
    await page.click('#live-data');
    await expect(page.locator('text=Use Live Database (OFF)')).toBeVisible();
  });

  test('should validate scores are within [0,1] range', async ({ page }) => {
    // Compute scores with default preset
    await page.click('button:text("Compute Stage 1 Scores")');
    await expect(page.locator('text=Stage 1 Scores')).toBeVisible();
    
    // Look for any score values and verify they're properly formatted
    const scoreElements = page.locator('.text-2xl.font-bold');
    const scoreCount = await scoreElements.count();
    
    expect(scoreCount).toBeGreaterThan(0);
    
    // Check that no validation errors appear
    const validationIssues = page.locator('.text-red-500:text("Some scores are outside [0,1] range")');
    await expect(validationIssues).toHaveCount(0);
    
    // Should see green checkmark for valid scores
    await expect(page.locator('svg.text-green-500')).toBeVisible();
  });

  test('should show different presets', async ({ page }) => {
    // Open preset selector
    await page.click('[data-testid="preset-selector"], .select-trigger');
    
    // Check that presets are available
    await expect(page.locator('text=Perfectionism & Anxiety')).toBeVisible();
    await expect(page.locator('text=Relational & Caretaking')).toBeVisible();
    await expect(page.locator('text=Control & Safety')).toBeVisible();
    
    // Select a different preset
    await page.click('text=Relational & Caretaking');
    
    // Compute scores with new preset
    await page.click('button:text("Compute Stage 1 Scores")');
    
    // Should see updated answers in the display
    await expect(page.locator('text=Current Answers')).toBeVisible();
  });

  test('should reset all data', async ({ page }) => {
    // First generate some data
    await page.click('button:text("Compute Stage 1 Scores")');
    await expect(page.locator('text=Stage 1 Scores')).toBeVisible();
    
    await page.click('button:text("Run Stage 2 Selection")');
    
    // Reset everything
    await page.click('button:text("Reset All")');
    
    // Scores should be cleared
    await expect(page.locator('text=Stage 1 Scores')).toHaveCount(0);
    
    // Stage 2 tab should be disabled again
    await expect(page.locator('[data-value="stage2"][disabled]')).toBeVisible();
  });

  test('should show raw JSON details', async ({ page }) => {
    // Compute scores
    await page.click('button:text("Compute Stage 1 Scores")');
    await expect(page.locator('text=Stage 1 Scores')).toBeVisible();
    
    // Open raw JSON details
    await page.click('summary:text("View Raw JSON")');
    
    // Should show JSON formatted scores
    await expect(page.locator('pre:text-matches("\\\\{[\\\\s\\\\S]*\\\\}")').first()).toBeVisible();
    
    // Run Stage 2 and check its details too
    await page.click('button:text("Run Stage 2 Selection")');
    await page.click('[data-value="stage2"]');
    
    await page.click('summary:text("View Selection Details")');
    await expect(page.locator('pre:text-matches("\\\\{[\\\\s\\\\S]*\\\\}")').nth(1)).toBeVisible();
  });
});
