import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const errors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const list: string[] = []
  errors.set(page, list)
  page.on('pageerror', (e) => list.push(e.message))
  page.on('console', (m) => m.type() === 'error' && list.push(m.text()))
})

test.afterEach(async ({ page }, info) => {
  if (info.title.includes('error state')) return
  expect(errors.get(page), 'no console or page errors').toEqual([])
})

async function open(page: Page, query = '') {
  await page.goto(`/${query}`)
  await expect(page.locator('.kpis .kpi-value').first()).toBeVisible()
}

const isPhone = (name: string) => name === 'phone'

test('loads with title, meta and default team', async ({ page }) => {
  await open(page)
  await expect(page).toHaveTitle(/Turnover Map/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /StatsBomb/)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og\.png$/)
  await expect(page.locator('.team-title')).toContainText('Leicester City')
  await expect(page.locator('.footer')).toContainText('StatsBomb Open Data')
})

test('static assets are served', async ({ request }) => {
  for (const path of ['/results.json', '/og.png', '/favicon.svg', '/apple-touch-icon.png']) {
    const r = await request.get(path)
    expect(r.status(), path).toBe(200)
  }
  const data = await (await request.get('/results.json')).json()
  expect(data.teams).toHaveLength(20)
})

test('team selector switches team and updates the URL', async ({ page }) => {
  await open(page)
  const before = await page.locator('.kpi-value').first().textContent()
  await page.locator('.picker select').selectOption('Arsenal')
  await expect(page.locator('.team-title')).toContainText('Arsenal')
  await expect(page).toHaveURL(/team=Arsenal/)
  await expect.poll(() => page.locator('.kpi-value').first().textContent()).not.toBe(before)
})

test('deep link loads that team, unknown team falls back', async ({ page }) => {
  await open(page, '?team=Tottenham%20Hotspur')
  await expect(page.locator('.team-title')).toContainText('Tottenham Hotspur')
  await open(page, '?team=Not%20A%20Club')
  await expect(page.locator('.team-title')).toContainText('Leicester City')
})

test('every team renders 24 zones per map and coach notes', async ({ page }) => {
  test.setTimeout(90_000) // walks all 20 teams; slower over the network against the live site
  await open(page)
  const teams = await page.locator('.picker option').allTextContents()
  expect(teams).toHaveLength(20)
  for (const t of teams) {
    await page.locator('.picker select').selectOption(t)
    await expect(page.locator('.team-title')).toContainText(t)
    await expect(page.locator('.side-won .zone')).toHaveCount(24)
    await expect(page.locator('.side-conceded .zone')).toHaveCount(24)
    await expect(page.locator('.note')).not.toHaveCount(0)
    await expect(page.locator('.notes')).not.toContainText(/\{|\}|undefined|NaN/)
  }
})

test('low-sample zones are hatched and show no value', async ({ page }) => {
  await open(page)
  const low = page.locator('.side-won .zone.low')
  expect(await low.count()).toBeGreaterThan(0)
  await expect(low.first().locator('.zone-value')).toHaveText('–')
  await expect(low.first().locator('.zone-hatch')).toHaveCount(1)
})

test('selecting a zone shows its numbers', async ({ page }) => {
  await open(page)
  const detail = page.locator('.side-won .detail')
  await expect(detail).toHaveClass(/empty/)
  await page.locator('.side-won .zone').nth(14).click()
  await expect(detail).toContainText('D3')
  await expect(detail).toContainText('Turnovers')
  await expect(detail.locator('dd').first()).toHaveText('50')
})

test('zones are keyboard operable', async ({ page }, info) => {
  test.skip(isPhone(info.project.name), 'keyboard test runs on desktop')
  await open(page)
  const zone = page.locator('.side-conceded .zone').nth(9)
  await zone.focus()
  await page.keyboard.press('Enter')
  await expect(zone).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.side-conceded .detail')).toContainText('C2')
})

test('colour mode toggle switches the scale', async ({ page }) => {
  await open(page)
  await expect(page.locator('.side-won .zone[class*="seq-"]').first()).toBeVisible()
  await page.getByRole('radio', { name: 'vs league average' }).click()
  await expect(page.locator('.side-won .zone[class*="div-"]').first()).toBeVisible()
  await expect(page.locator('.side-won .zone[class*="seq-"]')).toHaveCount(0)
  await expect(page.locator('.legend-title')).toContainText('league average')
})

test('chains overlay draws one arrow per shot', async ({ page, request }) => {
  await open(page)
  const data = await (await request.get('/results.json')).json()
  const team = data.teams.find((t: { name: string }) => t.name === 'Leicester City')
  await expect(page.locator('.chain')).toHaveCount(0)
  await page.locator('.switch').click()
  await expect(page.locator('.side-won .chain')).toHaveCount(team.won.totals.shots)
  await expect(page.locator('.side-conceded .chain')).toHaveCount(team.conceded.totals.shots)
  await expect(page.locator('.side-won .chain.goal')).toHaveCount(team.won.totals.goals)
  await page.locator('.switch').click()
  await expect(page.locator('.chain')).toHaveCount(0)
})

test('theme toggle switches and persists', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await open(page)
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'light')
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await page.locator('.icon-btn').click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(lightBg)
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'dark')
})

test('follows the system dark preference on first visit', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await open(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('table sorts and keeps low-sample rows last', async ({ page }) => {
  await open(page)
  const rows = page.locator('.table-scroll tbody tr')
  await expect(rows).toHaveCount(24)
  const lowFlags = await rows.evaluateAll((trs) => trs.map((tr) => tr.classList.contains('low')))
  const firstLow = lowFlags.indexOf(true)
  expect(lowFlags.slice(firstLow).every(Boolean), 'low rows grouped at the bottom').toBe(true)

  await page.getByRole('button', { name: /^Turnovers/ }).click()
  const ns = (await page.locator('.table-scroll tbody tr:not(.low) td:nth-child(3)').allTextContents()).map(Number)
  expect(ns).toEqual([...ns].sort((a, b) => b - a))

  await page.getByRole('radiogroup', { name: 'Table side' }).getByRole('radio', { name: 'Conceded' }).click()
  await expect(page.locator('.table-scroll tfoot')).toContainText('1327')
})

test('clip list filters goals and exports CSV', async ({ page }) => {
  await open(page)
  const clips = page.locator('.clip')
  await expect(clips).toHaveCount(12)
  await expect(page.locator('.clip-more')).toContainText('of 55')
  await page.locator('.check').click()
  await expect(page.locator('.clip.is-goal')).toHaveCount(await clips.count())
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()])
  expect(download.suggestedFilename()).toBe('leicester-city-won-regain-chains.csv')
  const csv = await (await download.createReadStream()).toArray()
  const lines = Buffer.concat(csv).toString().trim().split('\n')
  expect(lines[0]).toBe('date,opponent,venue,half,minute,won_by,how,shot_by,xg,goal,regain_x,regain_y')
  expect(lines.length - 1).toBe(7)
  expect(lines.slice(1).every((l) => l.includes(',yes,'))).toBe(true)
})

test('scatter dot loads another team', async ({ page }) => {
  await open(page)
  await page.locator('.sc-dot[aria-label^="Liverpool"]').click()
  await expect(page.locator('.team-title')).toContainText('Liverpool')
  await expect(page.locator('.picker select')).toHaveValue('Liverpool')
})

test('share copies the team link', async ({ page, context }, info) => {
  test.skip(isPhone(info.project.name), 'phones use the native share sheet')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page, '?team=Everton')
  await page.getByRole('button', { name: 'Share' }).click()
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/\?team=Everton$/)
})

test('print layout hides controls and keeps the maps', async ({ page }) => {
  await open(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.topbar')).toBeHidden()
  await expect(page.locator('.hero')).toBeHidden()
  await expect(page.locator('.map-controls')).toBeHidden()
  await expect(page.locator('.side-won .pitch')).toBeVisible()
  await expect(page.locator('.notes')).toBeVisible()
})

test('error state shows and retry recovers', async ({ page }) => {
  let fail = true
  await page.route('**/results.json', (route) => (fail ? route.abort() : route.continue()))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText("The data didn't arrive")
  fail = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.team-title')).toContainText('Leicester City')
})

test('loading skeleton appears before data', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  await page.route('**/results.json', async (route) => {
    await gate
    await route.continue()
  })
  await page.goto('/')
  await expect(page.locator('.skeleton')).toBeVisible()
  release()
  await expect(page.locator('.skeleton')).toHaveCount(0)
})

test('no horizontal scroll and tap targets are at least 44px', async ({ page }, info) => {
  test.skip(!isPhone(info.project.name), 'phone layout check')
  await open(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  const small = await page.$$eval('button, select, .switch, .check, a.brand', (els) =>
    els
      .filter((e) => (e as HTMLElement).offsetParent !== null)
      .map((e) => ({ t: (e.textContent || e.getAttribute('aria-label') || e.className).trim().slice(0, 30), h: e.getBoundingClientRect().height }))
      .filter((x) => x.h < 44),
  )
  expect(small).toEqual([])
  const zone = await page.locator('.side-won .zone-fill').first().boundingBox()
  expect(zone!.width).toBeGreaterThanOrEqual(44)
})

for (const scheme of ['light', 'dark'] as const) {
  test(`accessibility scan (${scheme})`, async ({ page }, info) => {
    test.skip(isPhone(info.project.name), 'scan runs once on desktop')
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await open(page)
    await page.addStyleTag({ content: '.reveal{opacity:1!important;transform:none!important}' })
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const summary = res.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`)
    expect(summary).toEqual([])
  })
}
