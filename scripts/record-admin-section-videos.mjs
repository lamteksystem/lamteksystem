import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'trademouldingsltd@gmail.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TradeMouldings-26'
const ROOT_DIR = process.cwd()
const OUTPUT_DIR = path.join(ROOT_DIR, 'demo-videos')
const RAW_VIDEO_DIR = path.join(OUTPUT_DIR, '_raw')

const SECTIONS = [
  { id: '01-dashboard', label: 'Dashboard', url: '/admin' },
  { id: '02-orders', label: 'Orders', url: '/admin/orders' },
  { id: '03-archived-orders', label: 'Archived Orders', url: '/admin/orders?archive=archived' },
  { id: '04-order-processing', label: 'Order Processing', url: '/admin/orders/processing' },
  { id: '05-create-order', label: 'Create Order', url: '/admin/create-order' },
  { id: '06-customers', label: 'Customers', url: '/admin/customers' },
  { id: '07-crm', label: 'CRM', url: '/admin/crm/open-orders' },
  { id: '08-catalogue', label: 'Catalogue', url: '/admin/catalogue' },
  { id: '09-stock', label: 'Stock Take', url: '/admin/stock' },
  { id: '10-locations', label: 'Locations', url: '/admin/locations' },
  { id: '11-uploads', label: 'Brochure and Pricelist', url: '/admin/uploads' },
  { id: '12-pricing', label: 'Pricing and Cost Control', url: '/admin/pricing' },
  { id: '13-reports', label: 'Reports', url: '/admin/reports' },
  { id: '14-accounting', label: 'Accounting', url: '/admin/accounting' },
  { id: '15-users', label: 'Users', url: '/admin/users' },
  { id: '16-create-user', label: 'Create User', url: '/admin/users/create' },
  { id: '17-tickets', label: 'Tickets', url: '/admin/tickets' },
  { id: '18-permissions', label: 'Permissions', url: '/admin/permissions' },
  { id: '19-settings', label: 'Settings', url: '/admin/settings' },
]

const SECTION_HINTS = {
  '01-dashboard': 'Overview cards and recent orders',
  '02-orders': 'Order list, filters, and status controls',
  '03-archived-orders': 'Archived order list and reopening actions',
  '04-order-processing': 'Placed and invoiced queue processing',
  '05-create-order': 'Create new order for a customer',
  '06-customers': 'Customer list and quick links',
  '07-crm': 'CRM pipeline board and activities',
  '08-catalogue': 'Product catalogue management',
  '09-stock': 'Stock levels and adjustments',
  '10-locations': 'Depot and location management',
  '11-uploads': 'Document uploads and archives',
  '12-pricing': 'Pricing rules and cost controls',
  '13-reports': 'Sales and product performance reports',
  '14-accounting': 'Customer balances and transactions',
  '15-users': 'User accounts directory',
  '16-create-user': 'Create a user form',
  '17-tickets': 'Support and returns tickets',
  '18-permissions': 'Role and permission rules',
  '19-settings': 'Admin personal and UI settings',
}

function cue(index, startSeconds, endSeconds, text) {
  const toTimestamp = (s) => {
    const whole = Math.max(0, Math.floor(s))
    const ms = Math.max(0, Math.floor((s - whole) * 1000))
    const hh = String(Math.floor(whole / 3600)).padStart(2, '0')
    const mm = String(Math.floor((whole % 3600) / 60)).padStart(2, '0')
    const ss = String(whole % 60).padStart(2, '0')
    const mmm = String(ms).padStart(3, '0')
    return `${hh}:${mm}:${ss}.${mmm}`
  }
  return `${index}\n${toTimestamp(startSeconds)} --> ${toTimestamp(endSeconds)}\n${text}\n`
}

function buildCaptions(sectionLabel) {
  const lines = [
    'WEBVTT\n',
    cue(1, 0.0, 3.0, `Trade Mouldings Admin Demo: ${sectionLabel}`),
    cue(2, 3.0, 8.5, 'Staff credentials are typed and sign-in is submitted.'),
    cue(3, 8.5, 16.5, `Navigating to ${sectionLabel}.`),
    cue(4, 16.5, 26.0, 'Section controls are demonstrated with scrolling and interactions.'),
    cue(5, 26.0, 31.0, 'Captions can be toggled with the player subtitles control.'),
  ]
  return lines.join('\n')
}

async function ensureDirs() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  await fs.mkdir(RAW_VIDEO_DIR, { recursive: true })
}

async function login(page) {
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' })
  const emailInput = page.locator('input[type="email"]').first()
  const passwordInput = page.locator('input[type="password"]').first()
  const submit = page.getByRole('button', { name: /Sign in to admin/i })

  await emailInput.click()
  await page.keyboard.type(ADMIN_EMAIL, { delay: 70 })
  await page.waitForTimeout(250)
  await passwordInput.click()
  await page.keyboard.type(ADMIN_PASSWORD, { delay: 70 })
  await page.waitForTimeout(300)
  await submit.hover()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /Sign in to admin/i }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)

  const currentUrl = page.url()
  const onAdminRoot = /\/admin(?:[/?#]|$)/.test(currentUrl)
  const stillOnLogin = /\/admin\/login(?:[/?#]|$)/.test(currentUrl)
  if (!onAdminRoot || stillOnLogin) {
    throw new Error(`Login failed for ${ADMIN_EMAIL}. Current URL: ${currentUrl}`)
  }
  await page.waitForTimeout(600)
}

async function clickFirstVisible(page, candidates) {
  for (const candidate of candidates) {
    const locator = candidate()
    const visible = await locator.isVisible().catch(() => false)
    if (visible) {
      await locator.click().catch(() => {})
      return true
    }
  }
  return false
}

async function sectionInteraction(page, section) {
  // Keep interactions simple and robust while ensuring each section differs.
  switch (section.id) {
    case '02-orders':
      await clickFirstVisible(page, [
        () => page.getByRole('button', { name: '▦' }).first(),
        () => page.getByRole('button', { name: '◫' }).first(),
      ])
      await page.waitForTimeout(600)
      await clickFirstVisible(page, [
        () => page.getByRole('button', { name: '☰' }).first(),
      ])
      return
    case '03-archived-orders':
      await clickFirstVisible(page, [
        () => page.getByRole('link', { name: /Edit order/i }).first(),
      ])
      await page.waitForTimeout(1100)
      await page.goBack({ waitUntil: 'networkidle' }).catch(() => {})
      return
    case '04-order-processing':
      await clickFirstVisible(page, [
        () => page.getByLabel(/Both/i).first(),
        () => page.getByLabel(/Invoiced/i).first(),
      ])
      return
    case '06-customers':
      await clickFirstVisible(page, [
        () => page.getByRole('link', { name: /View/i }).first(),
      ])
      await page.waitForTimeout(1000)
      await page.goBack({ waitUntil: 'networkidle' }).catch(() => {})
      return
    case '07-crm':
      await clickFirstVisible(page, [
        () => page.getByRole('button', { name: /Kanban/i }).first(),
        () => page.getByRole('button', { name: /Board/i }).first(),
      ])
      return
    case '08-catalogue':
      await clickFirstVisible(page, [
        () => page.getByRole('button', { name: /Audit/i }).first(),
      ])
      return
    case '11-uploads':
      await clickFirstVisible(page, [
        () => page.getByRole('button', { name: /Archived/i }).first(),
      ])
      return
    case '13-reports':
      await clickFirstVisible(page, [
        () => page.getByRole('tab', { name: /Sales/i }).first(),
        () => page.getByRole('button', { name: /Export/i }).first(),
      ])
      return
    case '15-users':
      await clickFirstVisible(page, [
        () => page.getByRole('link', { name: /Create user/i }).first(),
      ])
      await page.waitForTimeout(900)
      await page.goBack({ waitUntil: 'networkidle' }).catch(() => {})
      return
    default:
      return
  }
}

async function recordSection(browser, section) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: RAW_VIDEO_DIR,
      size: { width: 1920, height: 1080 },
    },
  })

  const page = await context.newPage()

  try {
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await login(page)
    await page.waitForTimeout(500)
    await page.goto(`${BASE_URL}${section.url}`, { waitUntil: 'networkidle' })
    const current = page.url()
    if (current.includes('/admin/login')) {
      throw new Error(`Session was not authenticated for ${section.id}`)
    }
    await page.waitForTimeout(1500)
    await page.mouse.move(200, 220, { steps: 25 })
    await page.waitForTimeout(300)
    await page.mouse.move(900, 350, { steps: 20 })
    await page.waitForTimeout(350)
    await sectionInteraction(page, section)
    await page.waitForTimeout(500)
    await page.mouse.wheel(0, 700)
    await page.waitForTimeout(1300)
    await page.mouse.wheel(0, -300)
    await page.waitForTimeout(1200)
    await page.mouse.move(1200, 160, { steps: 18 })
    await page.waitForTimeout(2600)
  } finally {
    const video = page.video()
    await context.close()
    if (!video) return null
    const recordedPath = await video.path()
    const finalVideoPath = path.join(OUTPUT_DIR, `${section.id}.webm`)
    await fs.copyFile(recordedPath, finalVideoPath)
    const captionPath = path.join(OUTPUT_DIR, `${section.id}.vtt`)
    await fs.writeFile(captionPath, buildCaptions(section.label), 'utf8')
    return {
      videoFile: `${section.id}.webm`,
      captionFile: `${section.id}.vtt`,
      label: section.label,
      hint: SECTION_HINTS[section.id] ?? '',
    }
  }
}

async function createIndex(results) {
  const rows = results.map((r) => `
    <section class="card">
      <h2>${r.label}</h2>
      <video controls preload="metadata" width="960">
        <source src="./${r.videoFile}" type="video/webm" />
        <track src="./${r.captionFile}" kind="subtitles" srclang="en" label="English captions" default />
      </video>
      <p class="note">${r.hint}</p>
      <p class="note">Captions are ON by default. Toggle with the CC/subtitles control.</p>
    </section>
  `).join('\n')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Trade Mouldings Admin Demo Videos</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; background: #f8fafc; color: #0f172a; }
    h1 { margin: 0 0 16px; }
    .grid { display: grid; gap: 16px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
    .note { margin: 8px 0 0; color: #475569; font-size: 14px; }
    video { max-width: 100%; border-radius: 8px; background: #000; }
  </style>
</head>
<body>
  <h1>Trade Mouldings Admin Demo Videos</h1>
  <p>One video per section, no narration, with toggleable captions.</p>
  <div class="grid">${rows}</div>
</body>
</html>`
  await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), html, 'utf8')
}

async function main() {
  await ensureDirs()
  const browser = await chromium.launch({ headless: true })
  const results = []
  try {
    for (const section of SECTIONS) {
      // eslint-disable-next-line no-console
      console.log(`Recording: ${section.label}`)
      const out = await recordSection(browser, section)
      if (out) results.push(out)
    }
  } finally {
    await browser.close()
  }
  await createIndex(results)
  // eslint-disable-next-line no-console
  console.log(`Done. Videos and captions are in: ${OUTPUT_DIR}`)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
