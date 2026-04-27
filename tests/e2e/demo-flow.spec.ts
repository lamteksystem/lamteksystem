import { test, expect } from '@playwright/test'

/** Seeded demo users/orders; skip in CI unless explicitly enabled (avoids flaky failures when DB has no DEMO-* refs). */
const runDemoSeedE2e = !process.env.CI || process.env.E2E_RUN_DEMO === '1'

const CUSTOMER_EMAIL = process.env.DEMO_CUSTOMER_EMAIL || 'demo@lamtek.co.uk'
const CUSTOMER_PASSWORD = process.env.DEMO_CUSTOMER_PASSWORD || 'Demo123!'

const STAFF_EMAIL = process.env.DEMO_STAFF_EMAIL || 'owners-demo@lamtek.co.uk'
const STAFF_PASSWORD = process.env.DEMO_STAFF_PASSWORD || 'Lamtek-26'

const PRODUCT_NAME_SNIPPET = 'Hadfield Painted 715 x 395'

const ORDER_PLACED_REF = 'DEMO-PLACED-001'
const ORDER_INVOICED_REF = 'DEMO-INVOICED-001'
const ORDER_ARCHIVED_REF = 'DEMO-ARCHIVED-001'

const describeDemo = runDemoSeedE2e ? test.describe : test.describe.skip

describeDemo('Seeded demo DB (set E2E_RUN_DEMO=1 in CI)', () => {
test('customer can sign in and browse products', async ({ page }) => {
  await page.goto('/login')

  // Deployed builds don't always expose form labels consistently for getByLabel(),
  // so we target the actual input types.
  await page.locator('input[type="email"]').first().fill(CUSTOMER_EMAIL)
  await page.locator('input[type="password"]').first().fill(CUSTOMER_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()

  // Customer redirect should land on "/"
  await page.waitForURL('**/')

  await page.goto('/products')
  await expect(page.getByText(PRODUCT_NAME_SNIPPET, { exact: false })).toBeVisible({ timeout: 30000 })
})

test('staff can sign in and view placed + archived orders', async ({ page }) => {
  // Avoid session bleed from the previous customer test (supabase auth uses browser storage).
  await page.context().clearCookies()
  await page.goto('about:blank')
  await page.evaluate(() => {
    try { localStorage.clear() } catch {}
    try { sessionStorage.clear() } catch {}
  })

  await page.goto('/admin/login')

  await page.locator('input[type="email"]').first().fill(STAFF_EMAIL)
  await page.locator('input[type="password"]').first().fill(STAFF_PASSWORD)
  await page.getByRole('button', { name: /Sign in to admin/i }).click()

  // Ensure staff area loaded (sidebar exists). This avoids continuing if we stayed on /admin/login.
  await expect(page.locator('.admin-sidebar')).toBeVisible({ timeout: 30000 })
  await expect(page).not.toHaveURL(/\/admin\/login/)

  await page.goto('/admin/orders?archive=archived')
  await page.locator('.admin-orders-header').waitFor({ state: 'visible', timeout: 30000 })
  // Wait for list fetch (header is visible while “Loading orders…” is still shown).
  await expect(page.getByRole('link', { name: ORDER_ARCHIVED_REF })).toBeVisible({ timeout: 30000 })
  await page.getByRole('link', { name: ORDER_ARCHIVED_REF }).first().click()
  await page.locator('input[placeholder="Order reference"]').waitFor({ state: 'visible', timeout: 30000 })
  await expect(page.getByText(ORDER_ARCHIVED_REF)).toBeVisible()

  await page.goto('/admin/orders/processing')
  await expect(page.getByText(ORDER_PLACED_REF)).toBeVisible({ timeout: 30000 })

  // Switch processing queue to "invoiced"
  const invoicedRadio = page.getByRole('radio', { name: /Invoiced/i })
  await invoicedRadio.check().catch(() => {})
  await expect(page.getByText(ORDER_INVOICED_REF)).toBeVisible({ timeout: 30000 })
})
})

