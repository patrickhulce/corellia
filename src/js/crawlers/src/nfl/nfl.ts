import * as fs from 'fs'
import * as path from 'path'
import {chromium, Page} from 'playwright'
import * as locators from './locators'
import {NflSavedGame, NflMainOptions, NflCrawlState} from './types'

function gameSaveToFilename(game: NflSavedGame, extension: string = 'json') {
  return `${game.season}-${game.week.replace(/\s+/g, '')}-${game.awayTeam}-at-${
    game.homeTeam
  }.${extension}`
}

function loadState(options: NflMainOptions): NflCrawlState {
  return {
    savedGames: fs
      .readdirSync(options.pathToSavedGames)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(options.pathToSavedGames, f), 'utf-8'))),
  }
}

const TARGET_WEEKS = Array.from({length: 17}, (_, i) => `Week ${i + 1}`).concat([
  'Wild Card Round',
  'Divisional Round',
  'Conference Championships',
  'Super Bowl',
])

async function logInToNflPlus(page: Page, options: NflMainOptions) {
  // Navigate to NFL.com
  await page.goto('https://www.nfl.com')

  const signInButton = await page.$('text="Sign In"')
  if (!signInButton) {
    throw new Error('Could not find the "Sign In" button')
  }

  await page.click('text="Accept Cookies"')

  // Click on the "Sign In" button
  await page.click('text="Sign In"')

  await page.waitForURL(/id\.nfl\.com/)

  // Enter username and click continue
  await page.fill('input[type="email"]', options.username)
  await page.click('text="Continue"')

  // Enter password and click continue
  await page.fill('input[autocomplete="current-password"]', options.password)
  await page.click('text="Sign In"')

  // Navigate to the replays page
  await page.goto('https://www.nfl.com/plus/replays')
}

async function selectTargetDownloadWeek(page: Page) {
  // Select season and week from dropdowns
  const $yearSelector = await locators.yearSelector(page)
  await $yearSelector.selectOption('2023') // Example: Selecting season 2023

  const targetWeek = TARGET_WEEKS[0]
  const $weekSelector = await locators.weekSelector(page)
  await $weekSelector.selectOption(targetWeek)

  await page.waitForSelector(`text="Replay ${targetWeek}"`)
}

async function selectGame(page: Page) {
  // List all available games
  const gameCards = await locators.gameCard(page)

  const games = await Promise.all(
    (
      await gameCards.all()
    ).map(async gameCard => {
      return locators.extractGameInfo(gameCard, {season: '2023', week: 'Week 1'})
    }),
  )

  console.log('Available games:', games)
}

async function downloadGame(page: Page) {}

export async function runNflCrawl(options: NflMainOptions) {
  const browser = await chromium.launch({headless: false})
  const context = await browser.newContext()
  const page = await context.newPage()

  await logInToNflPlus(page, options)
  await selectTargetDownloadWeek(page)
  await selectGame(page)
  await downloadGame(page)

  // Close browser
  await browser.close()
}
