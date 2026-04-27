import { test, expect } from '@playwright/test'

const email = process.env.E2E_CUSTOMER_EMAIL
const password = process.env.E2E_CUSTOMER_PASSWORD

test.describe('customer portal (E2E_CUSTOMER_*)', () => {
  test.skip(!email || !password, 'Set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD to run this suite')

  test('signs in and reaches ordering, cart, and account', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(email!)
    await page.locator('input[type="password"]').fill(password!)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 25_000 })

    await page.goto('/ordering')
    await expect(page.getByRole('heading', { name: /create order/i })).toBeVisible({ timeout: 20_000 })

    await page.goto('/ordering/cart')
    await expect(
      page.getByRole('heading', { name: /order cart|your cart is empty/i }),
    ).toBeVisible({ timeout: 15_000 })

    await page.goto('/account')
    await expect(page.getByRole('heading', { name: /my account/i })).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByTestId('account-statement-table').or(page.getByText(/no statement lines yet/i)),
    ).toBeVisible({ timeout: 10_000 })
  })
})
