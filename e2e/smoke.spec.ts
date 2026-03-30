// Placeholder E2E test — replace with real tests as features are implemented
import { test, expect } from '@playwright/test'

test('homepage loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Udemy/i)
})
