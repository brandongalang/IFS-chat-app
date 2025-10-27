import { test, expect } from '@playwright/test'

test.describe('Ethereal chat', () => {
  test('End session button disabled until first message, modal shows with redirect', async ({ page }) => {
    await page.goto('/chat')

    // End session button should be disabled initially
    const endButton = page.getByRole('button', { name: /end session/i })
    await expect(endButton).toBeVisible()
    await expect(endButton).toBeDisabled()
    await expect(endButton).toHaveAttribute('title', 'Send a message to start your session')

    // Start a session by sending a message
    await page.getByLabel('Message').fill('hello')
    await page.getByRole('button', { name: 'send' }).click()

    // End button should now be enabled after user has sent a message
    await expect(endButton).toBeEnabled()
    await expect(endButton).not.toHaveAttribute('title', 'Send a message to start your session')

    // Click end session
    await endButton.click()

    // Should show the end session modal
    await expect(page.getByTestId('end-session-dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Session Ended' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to Today' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start New Session' })).toBeVisible()

    // Click "Back to Today" to redirect
    await page.getByRole('button', { name: 'Back to Today' }).click()

    // Should be redirected to the home (Today) page
    await expect(page).toHaveURL('/')
    await expect(page.getByText('DAILY MEDITATIONS')).toBeVisible()
  })

  test('Can start new session from end session modal', async ({ page }) => {
    await page.goto('/chat')

    // Send a message
    await page.getByLabel('Message').fill('test message')
    await page.getByRole('button', { name: 'send' }).click()

    // End the session
    const endButton = page.getByRole('button', { name: /end session/i })
    await endButton.click()

    // Should show the modal
    await expect(page.getByTestId('end-session-dialog')).toBeVisible()

    // Choose to start new session
    await page.getByRole('button', { name: 'Start New Session' }).click()

    // Modal should close and chat should be reset
    await expect(page.getByTestId('end-session-dialog')).not.toBeVisible()
    await expect(page.getByLabel('Message')).toHaveValue('')
    
    // End session button should be disabled again since no new messages
    await expect(endButton).toBeDisabled()
  })
})

