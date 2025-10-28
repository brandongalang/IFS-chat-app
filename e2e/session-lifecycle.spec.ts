import { test, expect } from '@playwright/test'

test.describe('Session Lifecycle - End Session Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Enable dev mode before each test
    await page.goto('/')
    await page.getByRole('button', { name: 'Enable Dev Mode' }).click()
    // Wait for dev mode to be fully enabled
    await expect(page.getByText('Preview data')).toBeVisible()
  })

  test('should start session, send message, and end session with proper state management', async ({ page }) => {
    // Go to chat page
    await page.getByTestId('nav-chat').click()
    
    // Handle potential auth redirect - should work in dev mode
    await page.waitForLoadState('domcontentloaded')
    
    // Start a new session
    await page.waitForSelector('[data-testid="start-session"]', { timeout: 10000 })
    await page.getByTestId('start-session').click()
    
    // Wait for session to initialize
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10000 })
    
    // Send a test message
    const testMessage = 'Hello, this is a test message'
    await page.getByTestId('chat-input').fill(testMessage)
    await page.getByTestId('send-message').click()
    
    // Verify message appears
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 15000 })
    
    // Look for end session button
    const endSessionButton = page.getByTestId('end-session')
    await expect(endSessionButton).toBeVisible({ timeout: 10000 })
    
    // Click end session
    await endSessionButton.click()
    
    // Verify end session modal appears
    await expect(page.getByTestId('end-session-modal')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/End this therapy session/)).toBeVisible()
    
    // Confirm end session
    await page.getByTestId('confirm-end-session').click()
    
    // Verify session ended state
    await expect(page.getByTestId('end-session-modal')).not.toBeVisible()
    await expect(endSessionButton).toBeDisabled()
    
    // Verify success toast or confirmation
    await expect(page.getByText(/session ended/i)).toBeVisible({ timeout: 5000 })
  })

  test('should handle session end with invalid session ID', async ({ page, context }) => {
    // Start a session normally first
    await page.getByTestId('nav-chat').click()
    await page.waitForLoadState('domcontentloaded')
    
    await page.waitForSelector('[data-testid="start-session"]', { timeout: 10000 })
    await page.getByTestId('start-session').click()
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10000 })
    
    // Intercept session end call and modify the session ID to invalid value
    await page.route('/api/session/end', async (route) => {
      const request = route.request()
      const postData = JSON.parse(request.postData() || '{}')
      
      // Modify session ID to be invalid
      const modifiedData = {
        ...postData,
        sessionId: 'invalid-session-id-123'
      }
      
      // Continue with modified request
      await route.continue({
        postData: JSON.stringify(modifiedData)
      })
    })
    
    // Try to end session
    await page.getByTestId('end-session').click()
    await page.getByTestId('confirm-end-session').click()
    
    // Should handle error gracefully
    await expect(page.getByText(/Failed to end session|session not found/i)).toBeVisible({ timeout: 5000 })
  })

  test('should work with all three test personas (beginner, moderate, advanced)', async ({ page }) => {
    const personas = ['beginner', 'moderate', 'advanced'] as const
    
    for (const persona of personas) {
      // Set persona in localStorage
      await page.evaluate((p) => {
        localStorage.setItem('IFS_TEST_PERSONA', p)
      }, persona)
      
      // Reload page to apply persona
      await page.reload()
      await page.getByRole('button', { name: 'Enable Dev Mode' }).click()
      await expect(page.getByText('Preview data')).toBeVisible()
      
      // Go to chat and create session
      await page.getByTestId('nav-chat').click()
      await page.waitForLoadState('domcontentloaded')
      
      await page.waitForSelector('[data-testid="start-session"]', { timeout: 10000 })
      await page.getByTestId('start-session').click()
      await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10000 })
      
      // Verify session creation worked for this persona
      await page.getByTestId('chat-input').fill(`Test message from ${persona}`)
      await page.getByTestId('send-message').click()
      await expect(page.getByText(`Test message from ${persona}`)).toBeVisible({ timeout: 15000 })
      
      // End session
      await page.getByTestId('end-session').click()
      await page.getByTestId('confirm-end-session').click()
      await expect(page.getByTestId('end-session')).toBeDisabled()
      
      // Go back to home for next persona
      await page.getByTestId('nav-today').click()
    }
  })

  test('should handle dev mode auth bypass when Supabase unavailable', async ({ page }) => {
    // This test validates that the APIs work even when Supabase is down
    
    // Intercept Supabase calls to simulate network failure
    await page.route('**/rest/v1/**', async (route) => {
      await route.abort('failed')
    })
    
    // Start session - should still work with dev mode fallback
    await page.getByTestId('nav-chat').click()
    await page.waitForLoadState('domcontentloaded')
    
    await page.waitForSelector('[data-testid="start-session"]', { timeout: 10000 })
    await page.getByTestId('start-session').click()
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10000 })
    
    // Send message should work with fallback
    await page.getByTestId('chat-input').fill('Test message without Supabase')
    await page.getByTestId('send-message').click()
    
    // Check if message appears (may work with local storage fallback)
    const messageElement = page.getByText('Test message without Supabase')
    await expect(messageElement).toBeVisible({ timeout: 10000 })
    
    // End session should also work with fallback
    await page.getByTestId('end-session').click()
    await page.getByTestId('confirm-end-session').click()
    await expect(page.getByTestId('end-session')).toBeDisabled()
  })

  test('should redirect correctly after ending session via modal interactions', async ({ page }) => {
    // Start session and send message
    await page.getByTestId('nav-chat').click()
    await page.waitForLoadState('domcontentloaded')
    
    await page.waitForSelector('[data-testid="start-session"]', { timeout: 10000 })
    await page.getByTestId('start-session').click()
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10000 })
    
    await page.getByTestId('chat-input').fill('Test redirect behavior')
    await page.getByTestId('send-message').click()
    await expect(page.getByText('Test redirect behavior')).toBeVisible({ timeout: 15000 })
    
    // End session and test "Back to Today" option
    await page.getByTestId('end-session').click()
    await expect(page.getByTestId('end-session-modal')).toBeVisible()
    
    // Click "Back to Today" 
    await page.getByTestId('back-to-today').click()
    
    // Should redirect to home page
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('nav-today')).toHaveClass(/active/)
    
    // Go back to chat and test "Start New Session" option
    await page.getByTestId('nav-chat').click()
    await page.waitForLoadState('domcontentloaded')
    
    await page.waitForSelector('[data-testid="start-session"]', { timeout: 10000 })
    await page.getByTestId('start-session').click()
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10000 })
    
    await page.getByTestId('chat-input').fill('Another test message')
    await page.getByTestId('send-message').click()
    
    // End session and test "Start New Session"
    await page.getByTestId('end-session').click()
    await page.getByTestId('start-new-session').click()
    
    // Should reset chat UI for new session
    await expect(page.getByTestId('start-session')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('chat-input')).not.toBeVisible()
    await expect(page.getByTestId('end-session')).toBeDisabled()
  })
})

test.describe('Session API Contract Tests', () => {
  test('should verify session start API contract', async ({ request }) => {
    // Direct API test for session start
    const response = await request.post('/api/session/start', {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data).toHaveProperty('sessionId')
    expect(typeof data.sessionId).toBe('string')
    expect(data.sessionId.length).toBeGreaterThan(0)
  })

  test('should verify session end API contract', async ({ request }) => {
    // First start a session
    const startResponse = await request.post('/api/session/start', {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    const startData = await startResponse.json()
    const sessionId = startData.sessionId
    
    // Test session end with valid session ID
    const endResponse = await request.post('/api/session/end', {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        sessionId: sessionId
      }
    })
    
    expect(endResponse.status()).toBe(200)
    
    const endData = await endResponse.json()
    expect(endData).toHaveProperty('ok', true)
    expect(endData).toHaveProperty('ended', true)
  })

  test('should handle session end API without sessionId', async ({ request }) => {
    const response = await request.post('/api/session/end', {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {}
    })
    
    expect(response.status()).toBe(400)
    
    const data = await response.json()
    expect(data).toHaveProperty('message', 'sessionId is required')
  })
})
