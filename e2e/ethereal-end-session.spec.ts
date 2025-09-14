import { test, expect } from '@playwright/test'

test.describe('Ethereal chat', () => {
  test('End session redirects to home page', async ({ page }) => {
    await page.goto('/chat')

    // Start a session by sending a message
    await page.getByLabel('Message').fill('hello')
    await page.getByRole('button', { name: 'send' }).click()

    // End button appears once session is active
    const endButton = page.getByRole('button', { name: 'end' })
    await expect(endButton).toBeVisible()

    // Confirm ending the session
    await endButton.click()
    await expect(page.getByRole('button', { name: 'End session' })).toBeVisible()
    await page.getByRole('button', { name: 'End session' }).click()

    // After ending, user should be redirected to the home (Today) page
    await expect(page).toHaveURL('/')
    await expect(page.getByText('DAILY MEDITATIONS')).toBeVisible()
  })
})

