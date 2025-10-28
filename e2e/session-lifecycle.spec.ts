import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type PersonaKey = 'beginner' | 'moderate' | 'advanced'

const PERSONA_NAMES: Record<PersonaKey, string> = {
  beginner: 'Alex Beginner',
  moderate: 'Jamie Moderate',
  advanced: 'Riley Advanced',
}

async function submitMessage(page: Page, text: string) {
  const input = page.getByLabel('Message', { exact: true })
  await expect(input).toBeVisible()
  await input.fill(text)
  const sendButton = page.getByRole('button', { name: /^send$/i })
  await expect(sendButton).toBeEnabled()
  await sendButton.click()
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 15_000 })
}

test.describe('Session lifecycle (Ethereal chat)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('IFS_DEV_MODE', 'true')
      localStorage.setItem('ifs-test-persona', 'beginner')
    })
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
  })

  test('allows ending a session and starting a new one inline', async ({ page }) => {
    const endButton = page.getByRole('button', { name: /end session/i })
    await expect(endButton).toBeDisabled()

    await submitMessage(page, 'Hello, this is a lifecycle test message')

    await expect(endButton).toBeEnabled()
    await endButton.click()

    const dialog = page.getByTestId('end-session-dialog')
    await expect(dialog).toBeVisible()

    await page.getByTestId('start-new-session').click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('button', { name: /end session/i })).toBeDisabled()
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('')
  })

  test('redirects to Today when choosing that option in the modal', async ({ page }) => {
    await submitMessage(page, 'Redirect scenario message')

    await page.getByRole('button', { name: /end session/i }).click()
    await expect(page.getByTestId('end-session-dialog')).toBeVisible()

    await page.getByTestId('back-to-today').click()
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('nav-today')).toHaveAttribute('aria-current', 'page')
  })

  test('supports all predefined personas', async ({ page }) => {
    const personas: PersonaKey[] = ['beginner', 'moderate', 'advanced']

    for (const persona of personas) {
      await page.evaluate((value) => {
        localStorage.setItem('ifs-test-persona', value)
      }, persona)

      await page.reload()
      await page.waitForLoadState('domcontentloaded')

      await expect(
        page.getByText(new RegExp(`Dev Mode: ${PERSONA_NAMES[persona]}`, 'i')),
      ).toBeVisible()

      await submitMessage(page, `Persona message from ${persona}`)
      await page.getByRole('button', { name: /end session/i }).click()
      await page.getByTestId('start-new-session').click()
    }
  })

  test('can finish sessions even when Supabase requests fail', async ({ page }) => {
    await page.route('**/rest/v1/**', async (route) => {
      await route.abort('failed')
    })

    await submitMessage(page, 'Test message without Supabase')
    await page.getByRole('button', { name: /end session/i }).click()
    await expect(page.getByTestId('end-session-dialog')).toBeVisible()
    await page.getByTestId('start-new-session').click()
    await expect(page.getByRole('button', { name: /end session/i })).toBeDisabled()
  })
})
