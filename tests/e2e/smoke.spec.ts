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

