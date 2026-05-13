import { test, expect } from '@playwright/test'

test('loads login page', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('img', { name: 'Lamtek' })).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
})

test('loads admin login page', async ({ page }) => {
  await page.goto('/admin/login')
  await expect(page.getByRole('img', { name: 'Lamtek' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /staff sign in/i })).toBeVisible()
})

test('marketing home header omits hub links and shows primary actions', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Quality kitchens/i })).toBeVisible({ timeout: 15_000 })
  const header = page.locator('header.marketing-header')
  await expect(header.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await expect(header.getByRole('link', { name: 'Products', exact: true })).toBeVisible()
  await expect(header.getByRole('button', { name: 'Light' })).toBeVisible()
  await expect(header.getByRole('link', { name: 'Login', exact: true })).toBeVisible()
  await expect(header.getByRole('link', { name: 'Lamtek.co.uk' })).toHaveCount(0)
  await expect(header.getByRole('link', { name: /^Complete$/ })).toHaveCount(0)
  await expect(header.getByRole('link', { name: /^Tealbury$/ })).toHaveCount(0)
})

